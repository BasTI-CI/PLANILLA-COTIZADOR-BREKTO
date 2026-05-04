import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const BREKTO_URL =
  "https://lhajjchcbrqgwdazhpxk.supabase.co/functions/v1/stock-get-stock";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    console.log("[PROXY] calling BREKTO:", BREKTO_URL);

    const response = await fetch(BREKTO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": Deno.env.get("INTERNAL_SYNC_TOKEN")!
      },
      body: JSON.stringify(body)
    });

    console.log("[PROXY] status:", response.status);
    console.log("[PROXY] ok:", response.ok);

    const text = await response.text();
    console.log("[PROXY] response body:", text);

    console.log("[PROXY] status:", response.status);

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "error"
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});