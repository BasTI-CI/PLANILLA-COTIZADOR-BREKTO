import { getSupabase } from '@/lib/supabase'
import type { ProyectoSupabase, UnidadSupabase } from '@/types'
import type { StockRepository } from '../types'
import { mapProyectoRowDefinitivo, mapUnidadRowDefinitivo } from './mapDefinitivo'
import { FK_UNIDAD_PROYECTO, TABLAS_DEFINITIVO } from './schema'
import type { ProyectoRowDefinitivo, UnidadRowDefinitivo } from './rawRowTypes'

/**
 * Stock desde tablas definitivas en Supabase.
 * Ajusta `schema.ts`, `rawRowTypes.ts` y `mapDefinitivo.ts` al esquema real.
 */
export class SupabaseDefinitivoRepository implements StockRepository {
  async listProyectos(): Promise<ProyectoSupabase[]> {
    const supabase = getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase
      .from(TABLAS_DEFINITIVO.proyectos)
      .select('*')
      .order('nombre', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as ProyectoRowDefinitivo[]).map(mapProyectoRowDefinitivo)
  }

  async listUnidadesByProyecto(proyectoId: string): Promise<UnidadSupabase[]> {
    if (!proyectoId) return []
    const supabase = getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase
      .from(TABLAS_DEFINITIVO.unidades)
      .select('*')
      .eq(FK_UNIDAD_PROYECTO, proyectoId)
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as UnidadRowDefinitivo[]).map(mapUnidadRowDefinitivo)
  }
}
