import { getSupabase } from '@/lib/supabase'
import type { UnidadSupabase } from '@/types'

/** Nombre exacto de la Edge Function en Supabase (slug). */
export const EDGE_FUNCTION_GET_STOCK = 'get-stock' as const

export const DEFAULT_GET_STOCK_LIMIT = 200

export interface GetStockParams {
  inmobiliaria: string
  proyecto: string
  /** Búsqueda por número/código de unidad (opcional). */
  unidad?: string
  /** Solo si viene informada; omitir si vacío. */
  tipologia?: string
  limit?: number
  /** Si el ítem no trae `proyecto_id`, se usa este id (proyecto seleccionado en UI). No se envía en el body. */
  proyectoIdContext?: string
}

export interface GetStockResponse {
  success?: boolean
  items?: unknown[]
  total?: number
}

function n(v: unknown, def = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const x = Number(v.replace(',', '.'))
    return Number.isFinite(x) ? x : def
  }
  return def
}

function s(v: unknown, def = ''): string {
  if (v == null) return def
  return String(v).trim()
}

function b(v: unknown, def = true): boolean {
  if (typeof v === 'boolean') return v
  return def
}

/**
 * Normaliza un ítem devuelto por la Edge Function `get-stock` al modelo de la app.
 */
export function mapStockItemToUnidadSupabase(
  raw: Record<string, unknown>,
  proyectoIdFallback: string
): UnidadSupabase | null {
  const id = s(raw.id ?? raw.unidad_id ?? raw.id_unidad)
  if (!id) return null

  const numero = s(raw.numero ?? raw.number ?? raw.nro ?? raw.codigo)
  return {
    id,
    proyecto_id: s(raw.proyecto_id ?? raw.proyectoId, proyectoIdFallback),
    numero: numero || id,
    tipologia: s(raw.tipologia ?? raw.tipo ?? raw.modelo, '—'),
    sup_interior_m2: n(raw.sup_interior_m2 ?? raw.sup_interior ?? raw.m2_interior),
    sup_terraza_m2: n(raw.sup_terraza_m2 ?? raw.sup_terraza ?? raw.m2_terraza),
    sup_total_m2: n(raw.sup_total_m2 ?? raw.sup_total ?? raw.m2_total),
    orientacion: s(raw.orientacion ?? raw.orientación),
    entrega: s(raw.entrega ?? raw.fecha_entrega),
    precio_lista_uf: n(raw.precio_lista_uf ?? raw.precio_lista ?? raw.precio_uf),
    descuento_uf: n(raw.descuento_uf ?? raw.descuento),
    precio_neto_uf: n(raw.precio_neto_uf ?? raw.precio_neto),
    bono_descuento_pct: n(raw.bono_descuento_pct ?? raw.bono_pct),
    bono_max_pct: n(raw.bono_max_pct),
    bono_aplica_adicionales: b(raw.bono_aplica_adicionales, false),
    pie_pct: n(raw.pie_pct),
    estacionamiento_uf: n(raw.estacionamiento_uf),
    bodega_uf: n(raw.bodega_uf),
    disponible: raw.disponible === undefined ? true : Boolean(raw.disponible),
  }
}

/**
 * Body enviado a la Edge Function (solo estos campos; opcionales omitidos si vacíos).
 */
export function buildGetStockBody(params: GetStockParams): Record<string, string | number> {
  const inm = params.inmobiliaria.trim()
  const proy = params.proyecto.trim()
  const unidad = params.unidad?.trim()
  const tipologia = params.tipologia?.trim()
  const limit = params.limit ?? DEFAULT_GET_STOCK_LIMIT

  const body: Record<string, string | number> = {
    inmobiliaria: inm,
    proyecto: proy,
    limit,
  }
  if (unidad) body.unidad = unidad
  if (tipologia) body.tipologia = tipologia
  return body
}

/**
 * Consulta stock vía `supabase.functions.invoke` → POST a `/functions/v1/get-stock`.
 */
export async function getStock(params: GetStockParams): Promise<UnidadSupabase[]> {
  const supabase = getSupabase()
  if (!supabase) {
    console.error('[STOCK] getStock abortado: Supabase no está configurado')
    throw new Error('Supabase no está configurado')
  }

  const inm = params.inmobiliaria.trim()
  const proy = params.proyecto.trim()
  if (!inm || !proy) {
    console.error('[STOCK] getStock abortado: faltan inmobiliaria o proyecto')
    throw new Error('inmobiliaria y proyecto son obligatorios')
  }

  const body = buildGetStockBody(params)

  console.info('[STOCK] invoking get-stock', EDGE_FUNCTION_GET_STOCK)
  console.info('[STOCK] payload enviado', JSON.parse(JSON.stringify(body)))

  const invokeResult = await supabase.functions.invoke(EDGE_FUNCTION_GET_STOCK, {
    method: 'POST',
    body,
  })

  const { data, error } = invokeResult
  const response = 'response' in invokeResult ? invokeResult.response : undefined

  if (response) {
    console.info('[STOCK] HTTP response', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      method: 'POST',
    })
  }

  if (error) {
    console.error('[STOCK] error capturado (invoke)', error)
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(msg)
  }

  console.info('[STOCK] response completa (body parseado)', data)

  const payload = data as GetStockResponse | null
  if (payload == null) {
    throw new Error('Respuesta vacía de get-stock')
  }
  if (payload.success === false) {
    throw new Error('get-stock indicó success: false')
  }

  const items = payload.items
  if (!Array.isArray(items)) {
    console.info('[STOCK] items no es array → 0 resultados')
    return []
  }

  const proyectoIdFallback = params.proyectoIdContext?.trim() ?? ''
  const out: UnidadSupabase[] = []
  for (const item of items) {
    if (item == null || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const u = mapStockItemToUnidadSupabase(row, proyectoIdFallback)
    if (u) out.push(u)
  }

  console.info('[STOCK] cantidad de resultados mapeados', out.length)
  return out
}
