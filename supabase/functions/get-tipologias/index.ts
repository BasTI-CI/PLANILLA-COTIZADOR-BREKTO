import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};

const ENDPOINT =
  `https://lhajjchcbrqgwdazhpxk.supabase.co/functions/v1/stock-get-tipologias`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  try {
    const { inmobiliaria, proyecto } =
      await req.json();

    const response = await fetch(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "x-internal-token":
            Deno.env.get(
              "INTERNAL_SYNC_TOKEN"
            )!
        },
        body: JSON.stringify({
          inmobiliaria,
          proyecto
        })
      }
    );

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type":
          "application/json",
        ...corsHeaders
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : "error"
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",
          ...corsHeaders
        }
      }
    );
  }
});