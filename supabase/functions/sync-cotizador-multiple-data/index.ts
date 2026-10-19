import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const inicio = Date.now();

  try {
    if (req.method !== "POST") {
      return jsonResponse(
        { error: "método no permitido" },
        405
      );
    }

    const token = req.headers.get("x-internal-token");

    if (token !== Deno.env.get("INTERNAL_SYNC_TOKEN")) {
      console.warn("[SYNC] Solicitud no autorizada");
      return jsonResponse(
        { error: "no autorizado" },
        401
      );
    }

    const { entity, data } = await req.json();

    if (!entity || !Array.isArray(data)) {
      return jsonResponse(
        { error: "entity y data[] son requeridos" },
        400
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[SYNC] Snapshot recibido", {
      entidad: entity,
      registros: data.length
    });

    switch (entity) {
      case "inmobiliaria":
        await syncSnapshot(
          supabase,
          "inmobiliarias",
          data
        );
        break;

      case "proyecto":
        await syncSnapshot(
          supabase,
          "proyectos",
          data
        );
        break;

      default:
        return jsonResponse(
          { error: `entidad no soportada: ${entity}` },
          400
        );
    }

    console.log("[SYNC] Snapshot sincronizado", {
      entidad: entity,
      registros: data.length,
      duracionMs: Date.now() - inicio
    });

    return jsonResponse({
      success: true,
      entidad: entity,
      registros: data.length,
      duracionMs: Date.now() - inicio
    });

  } catch (err) {
    console.error("[SYNC] Error fatal", err);

    return jsonResponse(
      {
        error:
          err instanceof Error
            ? err.message
            : "error desconocido"
      },
      500
    );
  }
});

async function syncSnapshot(
  supabase: any,
  tabla: string,
  data: any[]
) {
  if (!data.length) {
    throw new Error(
      `No se permite sincronizar snapshot vacío para ${tabla}`
    );
  }

  const ids = data.map((x) => x.id);

  const { error: upsertError } = await supabase
    .from(tabla)
    .upsert(data, {
      onConflict: "id"
    });

  if (upsertError) {
    throw new Error(
      `Falló upsert en ${tabla}: ${upsertError.message}`
    );
  }

  const { error: deleteError } = await supabase
    .from(tabla)
    .delete()
    .not("id", "in", `(${ids.join(",")})`);

  if (deleteError) {
    throw new Error(
      `Falló reconciliación delete en ${tabla}: ${deleteError.message}`
    );
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}