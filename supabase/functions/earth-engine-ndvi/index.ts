import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get access token from Google service account
async function getAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/earthengine.readonly",
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  }));

  const unsignedToken = `${header}.${payload}`;

  // Import the private key for signing
  const pemContent = credentials.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

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

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${header}.${payload}.${sig}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// Fetch NDVI from Earth Engine REST API using Sentinel-2 or MODIS
async function fetchNDVI(accessToken: string, lat: number, lon: number): Promise<number | null> {
  // Use Earth Engine REST API to compute NDVI
  // We'll use the computePixels endpoint with a MODIS NDVI product
  const projectId = "proud-lead-491322-q2";

  // Use MODIS NDVI 16-day composite (MOD13A2)
  const expression = {
    functionInvocationValue: {
      functionName: "Image.pixelLonLat",
      arguments: {}
    }
  };

  // Simpler approach: use the Earth Engine REST API v1 to get NDVI value
  // Using MODIS vegetation index product directly
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Last 30 days

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  // Use Earth Engine compute endpoint
  const computeUrl = `https://earthengine.googleapis.com/v1/projects/${projectId}:computePixels`;

  // Build an expression to get NDVI from MODIS
  const requestBody = {
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
    const res = await fetch(
      `https://earthengine.googleapis.com/v1/projects/${projectId}:computeFeatures`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!res.ok) {
      // Try alternative: simple image value endpoint
      console.log("computeFeatures failed, trying alternative approach...");
      return await fetchNDVIAlternative(accessToken, lat, lon, projectId, startStr, endStr);
    }

    const data = await res.json();
    console.log("EE Response:", JSON.stringify(data));

    // Extract NDVI value - MODIS NDVI is scaled by 10000
    if (data?.result?.NDVI !== undefined) {
      return data.result.NDVI / 10000; // Scale to 0-1 range
    }
    return null;
  } catch (err) {
    console.error("EE fetch error:", err);
    return null;
  }
}

async function fetchNDVIAlternative(
  accessToken: string, lat: number, lon: number,
  projectId: string, startStr: string, endStr: string
): Promise<number | null> {
  // Use the value endpoint for simpler queries
  const url = `https://earthengine.googleapis.com/v1/projects/${projectId}:value`;

  const body = {
    expression: {
      result: "0",
      values: {
        "0": {
          functionInvocationValue: {
            functionName: "Image.sample",
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
              region: {
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

    const data = await res.json();
    console.log("EE Alternative Response:", JSON.stringify(data));

    // Try to extract NDVI
    if (data?.features?.[0]?.properties?.NDVI !== undefined) {
      return data.features[0].properties.NDVI / 10000;
    }
    if (data?.result?.properties?.NDVI !== undefined) {
      return data.result.properties.NDVI / 10000;
    }

    return null;
  } catch (err) {
    console.error("EE alternative error:", err);
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
    const { points } = await req.json();

    if (!points || !Array.isArray(points) || points.length === 0) {
      throw new Error("Provide an array of {lat, lon, name} points");
    }

    // Get access token
    const accessToken = await getAccessToken(credentials);

    // Fetch NDVI for each point (limit to 15 concurrent)
    const results = await Promise.all(
      points.slice(0, 15).map(async (p: { lat: number; lon: number; name: string }) => {
        const ndvi = await fetchNDVI(accessToken, p.lat, p.lon);
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
