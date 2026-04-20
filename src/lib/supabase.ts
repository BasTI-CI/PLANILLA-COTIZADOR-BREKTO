import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente oficial `@supabase/supabase-js`.
 * URL: `VITE_SUPABASE_URL`. Clave pública (anon / publishable): `VITE_SUPABASE_ANON_KEY` o
 * `VITE_SUPABASE_PUBLISHABLE_KEY` (mismo valor que muestra el panel).
 *
 * Sin URL/key la app puede arrancar, pero la ruta `/access` no podrá invocar la Edge Function de validación.
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
