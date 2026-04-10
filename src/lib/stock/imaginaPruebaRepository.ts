/**
 * Implementación actual del contrato `StockRepository`: tabla de prueba
 * `Stock_Imagina_Prueba` en Supabase. Sustituir o añadir otras implementaciones
 * cuando exista el esquema multi-inmobiliaria / multi-proyecto.
 */
import { getSupabase } from '@/lib/supabase'
import type { ProyectoSupabase, UnidadSupabase } from '@/types'
import type { StockRepository } from './types'

// ─── Fila tal como viene de PostgREST (tabla de ejemplo) ──────────
interface StockRow {
  id: number
  depto: number
  modelo: string
  orientacion: string
  precio: number
  sup_int: number
  sup_terr: number
  sup_total: number
  dcto: number
  precio_dcto: number
  bono5: number
  precio_bono5: number
  bono10: number
  precio_bono10: number
}

const TABLA = 'Stock_Imagina_Prueba'

/** Proyecto sintético: la tabla de prueba no tiene dimensión proyecto. */
export const PROYECTO_IMAGINA: ProyectoSupabase = {
  id: 'imagina',
  nombre: 'Imagina',
  comuna: 'Santiago',
  barrio: '',
  direccion: '',
  inmobiliaria: 'Imagina Inmobiliaria',
}

const MOCK_PROYECTOS: ProyectoSupabase[] = [PROYECTO_IMAGINA]

export function mapStockRowToUnidad(row: StockRow): UnidadSupabase {
  return {
    id: String(row.id),
    proyecto_id: PROYECTO_IMAGINA.id,
    numero: String(row.depto),
    tipologia: row.modelo,
    sup_interior_m2: row.sup_int,
    sup_terraza_m2: row.sup_terr,
    sup_total_m2: row.sup_total,
    orientacion: row.orientacion,
    entrega: 'A convenir',
    precio_lista_uf: row.precio,
    descuento_uf: Math.round((row.precio - row.precio_dcto) * 100) / 100,
    precio_neto_uf: row.precio_dcto,
    bono_descuento_pct: row.dcto,
    bono_max_pct: row.bono10,
    bono_aplica_adicionales: false,
    pie_pct: 0.2,
    estacionamiento_uf: 0,
    bodega_uf: 0,
    disponible: true,
  }
}

export class ImaginaPruebaStockRepository implements StockRepository {
  /**
   * Sin cliente: mock. Con cliente: ping a la tabla; error de red/esquema → lanza
   * (el hook muestra mensaje y cae a mock).
   */
  async listProyectos(): Promise<ProyectoSupabase[]> {
    const supabase = getSupabase()
    if (!supabase) return [...MOCK_PROYECTOS]
    const { error } = await supabase.from(TABLA).select('id').limit(1)
    if (error) throw new Error(error.message)
    return [PROYECTO_IMAGINA]
  }

  /** Sin Supabase o fallo de consulta: lista vacía (comportamiento previo del hook). */
  async listUnidadesByProyecto(proyectoId: string): Promise<UnidadSupabase[]> {
    if (!proyectoId) return []
    const supabase = getSupabase()
    if (!supabase) return []
    try {
      const { data, error } = await supabase
        .from(TABLA)
        .select('*')
        .order('depto', { ascending: true })
      if (error) throw error
      return (data as StockRow[]).map(mapStockRowToUnidad)
    } catch {
      return []
    }
  }
}
