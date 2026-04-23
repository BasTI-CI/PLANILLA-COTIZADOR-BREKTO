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

/**
 * Cuerpo JSON devuelto por la Edge Function (tras parsear la respuesta HTTP).
 * Forma actual del backend: { success, data: StockItem[], count }.
 */
export interface GetStockEdgePayload {
  success?: boolean
  /** Lista principal de unidades/stock */
  data?: unknown[]
  count?: number
  /** Compat: respuestas antiguas que usaban `items` */
  items?: unknown[]
}

/**
 * Obtiene el array de filas desde el payload: prioriza `data`, luego `items`.
 */
export function extractStockRowsFromEdgePayload(payload: Record<string, unknown>): unknown[] {
  if (Array.isArray(payload.data)) {
    return payload.data
  }
  if (Array.isArray(payload.items)) {
    console.info('[STOCK] usando payload.items (compat); el backend expone la lista en payload.data')
    return payload.items
  }
  return []
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
 * Elige el texto de “número de unidad” para UI y `numero`.
 * Prioriza códigos cortos / numéricos; evita usar solo `codigo` largo tipo "Proyecto - Inmobiliaria"
 * cuando exista otro campo con el depto (ej. 316).
 */
export function pickNumeroUnidadFromStockRow(raw: Record<string, unknown>, idFallback: string): string {
  /** Prioridad: cualquier campo cuyo nombre sugiera número de depto y el valor sea solo dígitos. */
  for (const [key, val] of Object.entries(raw)) {
    if (!/num|nro|depto|dpto|unidad|torre|piso/i.test(key)) continue
    if (/^codigo$/i.test(key)) continue
    const t = s(val)
    if (/^\d{2,6}$/.test(t)) return t
  }

  const keysOrdered: (keyof typeof raw | string)[] = [
    'numero_departamento',
    'nro_depto',
    'numero_unidad',
    'nro_unidad',
    'depto',
    'numero',
    'unidad',
    'nro',
    'number',
    'codigo_unidad',
    'codigo',
    'glosa',
  ]
  const candidates: string[] = []
  for (const k of keysOrdered) {
    const v = raw[k as string]
    const t = s(v)
    if (t) candidates.push(t)
  }

  for (const t of candidates) {
    if (/^\d{1,6}$/.test(t)) return t
  }
  for (const t of candidates) {
    if (/^[A-Za-z]?\d{1,5}$/.test(t) || /^\d{1,4}-[A-Za-z0-9]+$/.test(t) || /^[A-Za-z]-\d+$/.test(t)) {
      return t
    }
  }
  for (const t of candidates) {
    if (t.includes(' - ') || t.includes(' – ') || t.includes(' — ')) {
      const m = t.match(/(\d{2,5})\s*$/)
      if (m) return m[1]
      const nums = t.match(/\d{2,5}/g)
      if (nums?.length) return nums[nums.length - 1]
    }
  }
  for (const t of candidates) {
    if (t) return t
  }
  return idFallback
}

function aplicarHintNumeroBusqueda(numero: string, hint: string | undefined): string {
  const h = hint?.trim() ?? ''
  if (!h || !/^\d{2,6}$/.test(h)) return numero
  const n = numero.trim()
  const plain = /^\d{2,6}$/.test(n) || /^[A-Za-z]?\d{1,5}$/i.test(n)
  const labelLike = /-|–|—/.test(n) && /[A-Za-zÀ-ÿ]{2,}/.test(n)
  if (!plain || labelLike) return h
  return numero
}

/**
 * Normaliza un ítem devuelto por la Edge Function `get-stock` al modelo de la app.
 * @param unidadBusquedaHint Texto de búsqueda por unidad en UI (ej. `316`): si el backend devuelve un `numero` tipo etiqueta "Proyecto - Inmobiliaria", se prefiere el hint.
 */
export function mapStockItemToUnidadSupabase(
  raw: Record<string, unknown>,
  proyectoIdFallback: string,
  unidadBusquedaHint?: string
): UnidadSupabase | null {
  const idRaw = raw.id ?? raw.unidad_id ?? raw.id_unidad
  const id = idRaw !== null && idRaw !== undefined && idRaw !== '' ? String(idRaw).trim() : ''
  if (!id) return null

  const base = pickNumeroUnidadFromStockRow(raw, id)
  const numero = aplicarHintNumeroBusqueda(base, unidadBusquedaHint)

  // Precios: el stock maestro guarda valores en UF (columnas sin sufijo _uf).
  // `precio_neto_uf` es derivado (no se lee de BD); mantiene la invariante lista − descuento = neto (§8.1).
  const precio_lista_uf = n(raw.precio_lista_uf ?? raw.precio_lista ?? raw.precio_uf)
  const descuento_uf = n(raw.descuento_uf ?? raw.descuento)
  const precio_neto_uf = Math.round((precio_lista_uf - descuento_uf) * 100) / 100

  // Bonos en el stock maestro vienen como porcentaje 0–100 (prefijo `f_*`); el motor usa decimal 0–1.
  const bono_descuento_pct =
    raw.f_desc_bono_inmobiliario != null
      ? n(raw.f_desc_bono_inmobiliario) / 100
      : n(raw.bono_descuento_pct ?? raw.bono_pct)

  return {
    id,
    proyecto_id: s(raw.proyecto_id ?? raw.proyectoId, proyectoIdFallback),
    numero: numero || id,
    tipologia: s(raw.tipologia ?? raw.tipo ?? raw.modelo, '—'),
    sup_interior_m2: n(raw.sup_interior_m2 ?? raw.sup_interior ?? raw.m2_interior ?? raw.superficie_util),
    sup_terraza_m2: n(raw.sup_terraza_m2 ?? raw.sup_terraza ?? raw.m2_terraza ?? raw.superficie_terraza),
    sup_total_m2: n(raw.sup_total_m2 ?? raw.sup_total ?? raw.m2_total),
    orientacion: s(raw.orientacion ?? raw.orientación),
    entrega: s(raw.entrega ?? raw.fecha_entrega),
    precio_lista_uf,
    descuento_uf,
    precio_neto_uf,
    bono_descuento_pct,
    // Campos que el asesor rellena en el formulario (no vienen del stock maestro en esta versión).
    bono_max_pct: 0,
    bono_aplica_adicionales: false,
    pie_pct: 0,
    estacionamiento_uf: 0,
    bodega_uf: 0,
    // El stock maestro entrega solo unidades disponibles (filtro aguas arriba).
    disponible: true,
    // Denormalizados: tienen precedencia sobre `ProyectoSupabase` al armar `DatosPropiedad`.
    proyecto_nombre: s(raw.proyecto ?? raw.proyecto_nombre) || undefined,
    comuna: s(raw.comuna) || undefined,
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

  console.info('[STOCK] invoke resultado completo (SDK)', invokeResult)

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

  // `data` aquí = cuerpo JSON de la Edge Function (equiv. a lo que en red es el body del 200).
  console.info('[STOCK] response.data (cuerpo función) = invokeResult.data', data)

  const payload = data as GetStockEdgePayload | null
  if (payload == null || typeof payload !== 'object') {
    throw new Error('Respuesta vacía de get-stock')
  }
  if (payload.success === false) {
    throw new Error('get-stock indicó success: false')
  }

  if (typeof payload.count === 'number') {
    console.info('[STOCK] count (backend)', payload.count)
  }

  const rawRows = extractStockRowsFromEdgePayload(payload as Record<string, unknown>)
  console.info('[STOCK] filas extraídas (payload.data o payload.items)', rawRows.length, {
    preview: rawRows.slice(0, 3),
  })

  const proyectoIdFallback = params.proyectoIdContext?.trim() ?? ''
  const hintUnidad = params.unidad?.trim()
  const out: UnidadSupabase[] = []
  for (const item of rawRows) {
    if (item == null || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const u = mapStockItemToUnidadSupabase(row, proyectoIdFallback, hintUnidad)
    if (u) out.push(u)
  }

  console.info('[STOCK] array final mapeado a UnidadSupabase[]', out.length, {
    preview: out.slice(0, 3),
  })
  return out
}
