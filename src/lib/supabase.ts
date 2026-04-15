import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente oficial `@supabase/supabase-js`.
 * En el panel de Supabase: Project URL → `VITE_SUPABASE_URL`, anon public → `VITE_SUPABASE_ANON_KEY`
 * (equivalente a SUPABASE_URL / SUPABASE_ANON_KEY en documentación; Vite solo expone variables con prefijo `VITE_`).
 *
 * Sin URL/key la app puede arrancar, pero la ruta `/access` no podrá invocar la Edge Function de validación.
 */
let client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  return Boolean(url && key)
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string
    )
  }
  return client
}
