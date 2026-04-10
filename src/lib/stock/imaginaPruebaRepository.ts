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

/**
 * Stock de demostración (misma forma que filas de `Stock_Imagina_Prueba`).
 * Se usa cuando no hay `VITE_SUPABASE_*` para poder cotizar y revisar la UI sin BD.
 * Con Supabase configurado, se listan siempre las filas reales de la tabla.
 */
export const MOCK_UNIDADES_IMAGINA: UnidadSupabase[] = [
  {
    id: 'demo-101',
    proyecto_id: 'imagina',
    numero: '101',
    tipologia: '2D2B',
    sup_interior_m2: 52.5,
    sup_terraza_m2: 8.2,
    sup_total_m2: 60.7,
    orientacion: 'Norponiente',
    entrega: 'A convenir',
    precio_lista_uf: 3_988,
    descuento_uf: 398.8,
    precio_neto_uf: 3_589.2,
    bono_descuento_pct: 0.15,
    bono_max_pct: 0.1,
    bono_aplica_adicionales: false,
    pie_pct: 0.2,
    estacionamiento_uf: 0,
    bodega_uf: 0,
    disponible: true,
  },
  {
    id: 'demo-205',
    proyecto_id: 'imagina',
    numero: '205',
    tipologia: '3D2B',
    sup_interior_m2: 68,
    sup_terraza_m2: 12,
    sup_total_m2: 80,
    orientacion: 'Oriente',
    entrega: 'A convenir',
    precio_lista_uf: 4_550,
    descuento_uf: 455,
    precio_neto_uf: 4_095,
    bono_descuento_pct: 0.12,
    bono_max_pct: 0,
    bono_aplica_adicionales: false,
    pie_pct: 0.2,
    estacionamiento_uf: 120,
    bodega_uf: 45,
    disponible: true,
  },
  {
    id: 'demo-312',
    proyecto_id: 'imagina',
    numero: '312',
    tipologia: '1D1B',
    sup_interior_m2: 38,
    sup_terraza_m2: 4.5,
    sup_total_m2: 42.5,
    orientacion: 'Poniente',
    entrega: 'A convenir',
    precio_lista_uf: 2_890,
    descuento_uf: 289,
    precio_neto_uf: 2_601,
    bono_descuento_pct: 0.1,
    bono_max_pct: 0.05,
    bono_aplica_adicionales: false,
    pie_pct: 0.2,
    estacionamiento_uf: 0,
    bodega_uf: 0,
    disponible: true,
  },
]

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

  /**
   * Sin cliente: stock de demostración Imagina (`MOCK_UNIDADES_IMAGINA`).
   * Con cliente: datos reales desde `Stock_Imagina_Prueba` (error PostgREST → propaga al hook).
   */
  async listUnidadesByProyecto(proyectoId: string): Promise<UnidadSupabase[]> {
    if (!proyectoId) return []
    const supabase = getSupabase()
    if (!supabase) {
      return proyectoId === PROYECTO_IMAGINA.id ? [...MOCK_UNIDADES_IMAGINA] : []
    }
    const { data, error } = await supabase
      .from(TABLA)
      .select('*')
      .order('depto', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as StockRow[]).map(mapStockRowToUnidad)
  }
}
