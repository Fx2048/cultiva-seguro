import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
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
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
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

// Get the most recent MODIS 16-day composite image ID
function getRecentModisImageId(): string {
  const now = new Date();
  // MODIS MOD13A2 composites start every 16 days from Jan 1
  // Go back 32 days to ensure we get a completed composite
  const d = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  // Round down to nearest 16-day period
  const compositeDoy = Math.floor((dayOfYear - 1) / 16) * 16 + 1;
  const compositeDate = new Date(year, 0, compositeDoy);
  const yStr = compositeDate.getFullYear();
  const mStr = String(compositeDate.getMonth() + 1).padStart(2, '0');
  const dStr = String(compositeDate.getDate()).padStart(2, '0');
  return `MODIS/061/MOD13A2/${yStr}_${mStr}_${dStr}`;
}

async function fetchNDVI(
  accessToken: string, lat: number, lon: number, projectId: string
): Promise<number | null> {
  const imageId = getRecentModisImageId();
  console.log(`Using MODIS image: ${imageId}`);

  const url = `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/value:compute`;

  // Simple expression: load single image, select NDVI band, sample at point
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
                        functionName: "Image.load",
                        arguments: {
                          id: { constantValue: imageId }
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
                  functionName: "GeometryConstructors.Point",
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
    if (data?.result?.NDVI !== undefined) {
      return data.result.NDVI / 10000;
    }
    if (typeof data?.result === "object") {
      for (const key of Object.keys(data.result)) {
        if (key.toLowerCase().includes("ndvi")) {
          return data.result[key] / 10000;
        }
      }
    }
    console.log("Could not extract NDVI:", JSON.stringify(data).substring(0, 300));
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

    console.log("Getting access token for:", credentials.client_email);
    const accessToken = await getAccessToken(credentials);
    console.log("Access token obtained successfully");

    const results = await Promise.all(
      points.slice(0, 15).map(async (p: { lat: number; lon: number; name: string }) => {
        const ndvi = await fetchNDVI(accessToken, p.lat, p.lon, projectId);
        return {
          lat: p.lat, lon: p.lon, name: p.name, ndvi,
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
