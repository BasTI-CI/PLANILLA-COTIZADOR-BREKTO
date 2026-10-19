import { serve } from "https://deno.land/std/http/server.ts";
import { verify } from "https://deno.land/x/djwt/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return jsonResponse(
        { error: "token requerido" },
        400
      );
    }

    const secret = Deno.env.get("COTIZADOR_SSO_SECRET");

    if (!secret) {
      throw new Error("missing secret");
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const payload = await verify(token, key);

    validatePayload(payload);

    const user = mapUser(payload);

    return jsonResponse({
      valid: true,
      user
    });

  } catch (err) {
    console.warn("[SSO]", {
      message:
        err instanceof Error
          ? err.message
          : "error",
      time: new Date().toISOString()
    });

    return jsonResponse(
      {
        valid: false,
        error: "token inválido o expirado"
      },
      401
    );
  }
});

function validatePayload(payload: any) {
  if (!payload) throw new Error("payload vacío");

  if (payload.iss !== "BREKTO") {
    throw new Error("issuer inválido");
  }

  const aud = Array.isArray(payload.aud)
    ? payload.aud
    : [payload.aud];

  if (!aud.includes("cotizador")) {
    throw new Error("audience inválido");
  }

  if (!payload.sub) {
    throw new Error("sub requerido");
  }

  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) {
    throw new Error("token expirado");
  }
}

function mapUser(payload: any) {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    roles: payload.roles ?? []
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}