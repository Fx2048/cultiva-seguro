import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Base64url encode
  const b64url = (str: string) => btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/earthengine.readonly",
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  }));

  const unsignedToken = `${header}.${payload}`;

  const pemContent = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = b64url(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed [${tokenRes.status}]: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function fetchNDVI(
  accessToken: string, 
  lat: number, 
  lon: number, 
  projectId: string
): Promise<number | null> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  // Use v1beta compute value endpoint
  // Use earthengine-legacy for public dataset access (MODIS)
  const cloudProject = "earthengine-legacy";
  const url = `https://earthengine.googleapis.com/v1beta/projects/${cloudProject}/value:compute`;

  const body = {
    expression: {
      result: "0",
      values: {
        "0": {
          functionInvocationValue: {
            functionName: "Image.reduceRegion",
            arguments: {
              image: {
                functionInvocationValue: {
                  functionName: "Image.select",
                  arguments: {
                    input: {
                      functionInvocationValue: {
                        functionName: "ImageCollection.mean",
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: "ImageCollection.filterDate",
                              arguments: {
                                collection: {
                                  functionInvocationValue: {
                                    functionName: "ImageCollection.load",
                                    arguments: {
                                      id: { constantValue: "MODIS/061/MOD13A2" }
                                    }
                                  }
                                },
                                start: { constantValue: startStr },
                                end: { constantValue: endStr }
                              }
                            }
                          }
                        }
                      }
                    },
                    bandSelectors: { constantValue: ["NDVI"] }
                  }
                }
              },
              reducer: {
                functionInvocationValue: {
                  functionName: "Reducer.mean",
                  arguments: {}
                }
              },
              geometry: {
                functionInvocationValue: {
                  functionName: "Geometry.Point",
                  arguments: {
                    coordinates: { constantValue: [lon, lat] }
                  }
                }
              },
              scale: { constantValue: 1000 }
            }
          }
        }
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log(`EE response for (${lat},${lon}) [${res.status}]:`, text.substring(0, 500));

    if (!res.ok) {
      console.error(`EE API error [${res.status}]:`, text.substring(0, 300));
      return null;
    }

    const data = JSON.parse(text);
    
    // MODIS NDVI is scaled by 10000
    if (data?.result?.NDVI !== undefined) {
      return data.result.NDVI / 10000;
    }
    // Try nested paths
    if (typeof data?.result === "object") {
      for (const key of Object.keys(data.result)) {
        if (key.toLowerCase().includes("ndvi")) {
          return data.result[key] / 10000;
        }
      }
    }
    
    console.log("Could not extract NDVI from response:", JSON.stringify(data).substring(0, 300));
    return null;
  } catch (err) {
    console.error(`EE fetch error for (${lat},${lon}):`, err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialsStr = Deno.env.get("GOOGLE_EARTH_ENGINE_CREDENTIALS");
    if (!credentialsStr) {
      throw new Error("GOOGLE_EARTH_ENGINE_CREDENTIALS not configured");
    }

    const credentials = JSON.parse(credentialsStr);
    const projectId = credentials.project_id;
    const { points } = await req.json();

    if (!points || !Array.isArray(points) || points.length === 0) {
      throw new Error("Provide an array of {lat, lon, name} points");
    }

    // Get access token
    console.log("Getting access token for:", credentials.client_email);
    const accessToken = await getAccessToken(credentials);
    console.log("Access token obtained successfully");

    // Fetch NDVI for each point (limit to 15)
    const results = await Promise.all(
      points.slice(0, 15).map(async (p: { lat: number; lon: number; name: string }) => {
        const ndvi = await fetchNDVI(accessToken, p.lat, p.lon, projectId);
        return {
          lat: p.lat,
          lon: p.lon,
          name: p.name,
          ndvi,
          source: ndvi !== null ? "satellite" : "unavailable",
        };
      })
    );

    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
