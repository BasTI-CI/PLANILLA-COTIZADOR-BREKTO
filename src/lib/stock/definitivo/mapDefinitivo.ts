import type { ProyectoSupabase, UnidadSupabase } from '@/types'
import type { ProyectoRowDefinitivo, UnidadRowDefinitivo } from './rawRowTypes'

function n(v: number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || Number.isNaN(v)) return fallback
  return v
}

function s(v: string | null | undefined, fallback = ''): string {
  return v ?? fallback
}

/**
 * Convierte % almacenado como 0–100 a decimal 0–1 si hace falta.
 * Ajusta si tu columna ya es decimal.
 */
function normalizarPctDecimal(v: number | null | undefined, assume0to100: boolean): number {
  if (v === null || v === undefined || Number.isNaN(v)) return 0
  if (!assume0to100) return v
  if (v > 1) return v / 100
  return v
}

/** Cambia `assumePorcentajeEs0a100` según cómo vengan `bono_*` en la BD. */
const PCT_EN_BD_ES_0_A_100 = false

/**
 * `ProyectoRowDefinitivo` → selector de proyecto.
 */
export function mapProyectoRowDefinitivo(row: ProyectoRowDefinitivo): ProyectoSupabase {
  const idInmo = row.id_inmobiliaria
  return {
    id: String(row.id),
    nombre: s(row.nombre, 'Sin nombre'),
    comuna: s(row.comuna),
    barrio: s(row.barrio),
    direccion: s(row.direccion),
    inmobiliaria: row.inmobiliaria_nombre ?? undefined,
    id_inmobiliaria: idInmo !== null && idInmo !== undefined ? String(idInmo) : undefined,
    estado: row.estado != null ? s(row.estado) : undefined,
  }
}

/**
 * Fila unidad → `UnidadSupabase` (entrada a `unidadSupabaseToDatosPropiedad`).
 * Aquí va el remapeo columnas BD → contrato del cotizador.
 */
export function mapUnidadRowDefinitivo(row: UnidadRowDefinitivo): UnidadSupabase {
  const lista = n(row.precio_lista_uf, 0)
  const neto = n(row.precio_neto_uf, 0)
  const desc =
    row.descuento_uf !== null && row.descuento_uf !== undefined
      ? n(row.descuento_uf)
      : Math.round((lista - neto) * 100) / 100

  const bDesc = normalizarPctDecimal(row.bono_descuento_pct, PCT_EN_BD_ES_0_A_100)
  const bMax = normalizarPctDecimal(row.bono_max_pct, PCT_EN_BD_ES_0_A_100)

  return {
    id: String(row.id),
    proyecto_id: String(row.proyecto_id),
    numero: s(row.numero, '?'),
    tipologia: s(row.tipologia, '—'),
    sup_interior_m2: n(row.sup_interior_m2),
    sup_terraza_m2: n(row.sup_terraza_m2),
    sup_total_m2: n(row.sup_total_m2),
    orientacion: s(row.orientacion),
    entrega: s(row.entrega, 'A convenir'),
    precio_lista_uf: lista,
    descuento_uf: desc,
    precio_neto_uf: neto,
    bono_descuento_pct: bDesc,
    bono_max_pct: bMax,
    bono_aplica_adicionales: row.bono_aplica_adicionales ?? false,
    pie_pct: row.pie_pct !== null && row.pie_pct !== undefined ? n(row.pie_pct, 0.2) : 0.2,
    estacionamiento_uf: n(row.estacionamiento_uf),
    bodega_uf: n(row.bodega_uf),
    disponible: row.disponible ?? true,
  }
}
