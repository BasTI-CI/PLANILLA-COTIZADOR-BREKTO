import { getSupabase } from '@/lib/supabase'

export interface GetTipologiasResponse {
  success: boolean
  items?: string[]
  total?: number
}

/**
 * Tipologías disponibles para la combinación inmobiliaria + proyecto (Edge Function `get-tipologias`).
 */
export async function getTipologias(inmobiliaria: string, proyecto: string): Promise<string[]> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase no está configurado')
  }

  const { data, error } = await supabase.functions.invoke('get-tipologias', {
    body: { inmobiliaria, proyecto },
  })

  if (error) {
    throw new Error(error.message)
  }

  const payload = data as GetTipologiasResponse | null
  if (payload == null || payload.success !== true) {
    throw new Error('Respuesta inválida de get-tipologias')
  }

  const items = payload.items
  if (!Array.isArray(items)) {
    return []
  }

  return items.map((x) => String(x).trim()).filter(Boolean)
}
