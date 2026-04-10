import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase solo si existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
 * Sin ellas la app arranca igual (cotización manual); los hooks usan datos mock.
 * La BD enlazada es provisional (validación); ver variables_calculo.md — prioridad motor vs capa datos.
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
