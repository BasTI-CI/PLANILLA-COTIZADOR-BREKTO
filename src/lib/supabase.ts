import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente oficial `@supabase/supabase-js`.
 *
 * En el panel de Supabase el proyecto expone `SUPABASE_URL` y `SUPABASE_ANON_KEY` (o “publishable”).
 * Con Vite las variables deben ir con prefijo `VITE_` o no se inyectan en el bundle del navegador:
 *   VITE_SUPABASE_URL  →  URL del proyecto
 *   VITE_SUPABASE_ANON_KEY  o  VITE_SUPABASE_PUBLISHABLE_KEY  →  clave pública anónima
 *
 * Sin URL y clave, `/access` no puede invocar `validate-cotizador-access`.
 */
let client: SupabaseClient | null = null

function supabasePublishableKey(): string | undefined {
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  const pub = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim()
  return anon || pub
}

export function isSupabaseConfigured(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  return Boolean(url && supabasePublishableKey())
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  const key = supabasePublishableKey()
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      key as string
    )
  }
  return client
}
