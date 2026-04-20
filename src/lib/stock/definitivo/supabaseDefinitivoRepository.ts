import { getSupabase } from '@/lib/supabase'
import type { InmobiliariaSupabase, ProyectoSupabase, UnidadSupabase } from '@/types'
import type { StockRepository } from '../types'
import { esEstadoActivoCatalogo, inmobiliariaPasaFiltroEstado } from '../estadoCatalogo'
import { mapProyectoRowDefinitivo, mapUnidadRowDefinitivo } from './mapDefinitivo'
import { FK_UNIDAD_PROYECTO, TABLAS_DEFINITIVO } from './schema'
import type { ProyectoRowDefinitivo, UnidadRowDefinitivo } from './rawRowTypes'

function mapInmoRowDefinitivo(row: Record<string, unknown>): InmobiliariaSupabase | null {
  const id = row.id
  if (id === null || id === undefined) return null
  return {
    id: String(id),
    codigo: typeof row.codigo === 'string' ? row.codigo : String(row.codigo ?? ''),
    nombre: typeof row.nombre === 'string' ? row.nombre : String(row.nombre ?? ''),
  }
}

/**
 * Stock desde tablas definitivas en Supabase.
 * Ajusta `schema.ts`, `rawRowTypes.ts` y `mapDefinitivo.ts` al esquema real.
 */
export class SupabaseDefinitivoRepository implements StockRepository {
  async listInmobiliarias(): Promise<InmobiliariaSupabase[]> {
    const supabase = getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase.from('inmobiliarias').select('*').order('nombre', { ascending: true })
    if (error) return []
    return ((data ?? []) as Record<string, unknown>[])
      .filter((row) => inmobiliariaPasaFiltroEstado(row))
      .map(mapInmoRowDefinitivo)
      .filter((x): x is InmobiliariaSupabase => x !== null)
  }

  async listProyectosByInmobiliaria(inmobiliariaId: string): Promise<ProyectoSupabase[]> {
    if (!inmobiliariaId) return []
    const supabase = getSupabase()
    if (!supabase) return []
    const n = Number(inmobiliariaId)
    if (Number.isNaN(n)) return []
    const { data, error } = await supabase
      .from(TABLAS_DEFINITIVO.proyectos)
      .select('*')
      .eq('id_inmobiliaria', n)
      .order('nombre', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as ProyectoRowDefinitivo[])
      .filter((row) => esEstadoActivoCatalogo(row.estado))
      .map(mapProyectoRowDefinitivo)
  }

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
