/**
 * Catálogo público en Supabase: tablas `proyectos` e `inmobiliarias`.
 * Solo registros con `estado` activo (ver `estadoCatalogo.ts`). Unidades: fase siguiente.
 */
import { getSupabase } from '@/lib/supabase'
import type { InmobiliariaSupabase, ProyectoSupabase, UnidadSupabase } from '@/types'
import type { StockRepository } from './types'
import { esEstadoActivoCatalogo, inmobiliariaPasaFiltroEstado } from './estadoCatalogo'

function mapInmobiliariaRow(row: Record<string, unknown>): InmobiliariaSupabase | null {
  const id = row.id
  if (id === null || id === undefined) return null
  const idNum = typeof id === 'number' ? id : Number(id)
  if (Number.isNaN(idNum)) return null
  return {
    id: String(idNum),
    codigo: typeof row.codigo === 'string' ? row.codigo : String(row.codigo ?? ''),
    nombre: typeof row.nombre === 'string' ? row.nombre : String(row.nombre ?? 'Sin nombre'),
  }
}

function mapProyectoRow(row: Record<string, unknown>, inmoNombrePorId: Map<number, string>): ProyectoSupabase | null {
  const id = row.id
  if (id === null || id === undefined) return null
  const idNum = typeof id === 'number' ? id : Number(id)
  if (Number.isNaN(idNum)) return null

  const idInmo = row.id_inmobiliaria
  const idInmoNum =
    idInmo === null || idInmo === undefined ? null : typeof idInmo === 'number' ? idInmo : Number(idInmo)

  const nombre = typeof row.nombre === 'string' ? row.nombre : String(row.nombre ?? '')
  const codigo = typeof row.codigo === 'string' ? row.codigo : String(row.codigo ?? '')
  const estadoRaw = row.estado == null ? '' : String(row.estado).trim()
  const nombreInmoCol =
    typeof row.nombre_inmobiliaria === 'string' ? row.nombre_inmobiliaria.trim() : ''

  const fromFk =
    idInmoNum != null && !Number.isNaN(idInmoNum)
      ? inmoNombrePorId.get(idInmoNum)?.trim()
      : undefined
  const inmoNombre = nombreInmoCol || fromFk || ''

  const comunaGeo =
    typeof row.comuna === 'string' ? row.comuna : row.comuna != null ? String(row.comuna) : ''

  return {
    id: String(idNum),
    nombre: nombre || 'Sin nombre',
    comuna: comunaGeo,
    barrio: codigo,
    direccion: '',
    inmobiliaria: inmoNombre || undefined,
    id_inmobiliaria: idInmoNum != null && !Number.isNaN(idInmoNum) ? String(idInmoNum) : undefined,
    estado: estadoRaw || undefined,
  }
}

export class ProyectosPublicRepository implements StockRepository {
  async listInmobiliarias(): Promise<InmobiliariaSupabase[]> {
    const supabase = getSupabase()
    if (!supabase) return []

    const { data: proyData, error: proyErr } = await supabase.from('proyectos').select('id_inmobiliaria, estado')
    if (proyErr) throw new Error(proyErr.message)

    const rows = (proyData ?? []) as { id_inmobiliaria: unknown; estado: unknown }[]
    const idsActivos = new Set<number>()
    for (const r of rows) {
      if (!esEstadoActivoCatalogo(r.estado)) continue
      const raw = r.id_inmobiliaria
      if (raw === null || raw === undefined) continue
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isNaN(n)) idsActivos.add(n)
    }

    if (idsActivos.size === 0) return []

    const ids = [...idsActivos]
    const { data: inmoData, error: inmoErr } = await supabase
      .from('inmobiliarias')
      .select('*')
      .in('id', ids)
      .order('nombre', { ascending: true })

    if (inmoErr) throw new Error(inmoErr.message)

    return ((inmoData ?? []) as Record<string, unknown>[])
      .filter((row) => inmobiliariaPasaFiltroEstado(row))
      .map((row) => mapInmobiliariaRow(row))
      .filter((x): x is InmobiliariaSupabase => x !== null)
  }

  async listProyectosByInmobiliaria(inmobiliariaId: string): Promise<ProyectoSupabase[]> {
    if (!inmobiliariaId) return []
    const supabase = getSupabase()
    if (!supabase) return []

    const idNum = Number(inmobiliariaId)
    if (Number.isNaN(idNum)) return []

    const { data: inmoRow } = await supabase.from('inmobiliarias').select('id, nombre').eq('id', idNum).maybeSingle()

    const inmoNombrePorId = new Map<number, string>()
    if (inmoRow && typeof inmoRow === 'object' && 'nombre' in inmoRow) {
      const nm = (inmoRow as { id: number; nombre: string }).nombre
      if (nm) inmoNombrePorId.set(idNum, nm)
    }

    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id_inmobiliaria', idNum)
      .order('nombre', { ascending: true })

    if (error) throw new Error(error.message)

    const proyRows = ((data ?? []) as Record<string, unknown>[]).filter((r) =>
      esEstadoActivoCatalogo(r.estado)
    )

    return proyRows.map((r) => mapProyectoRow(r, inmoNombrePorId)).filter((p): p is ProyectoSupabase => p !== null)
  }

  async listProyectos(): Promise<ProyectoSupabase[]> {
    const supabase = getSupabase()
    if (!supabase) return []

    const [proyRes, inmoRes] = await Promise.all([
      supabase.from('proyectos').select('*').order('nombre', { ascending: true }),
      supabase.from('inmobiliarias').select('id, nombre'),
    ])

    if (proyRes.error) throw new Error(proyRes.error.message)

    const inmoNombrePorId = new Map<number, string>()
    if (!inmoRes.error && inmoRes.data) {
      for (const r of inmoRes.data as { id: number | string; nombre: string }[]) {
        const id = typeof r.id === 'number' ? r.id : Number(r.id)
        if (!Number.isNaN(id)) inmoNombrePorId.set(id, r.nombre)
      }
    }

    const rows = ((proyRes.data ?? []) as Record<string, unknown>[]).filter((r) =>
      esEstadoActivoCatalogo(r.estado)
    )
    return rows
      .map((row) => mapProyectoRow(row, inmoNombrePorId))
      .filter((p): p is ProyectoSupabase => p !== null)
  }

  async listUnidadesByProyecto(_proyectoId: string): Promise<UnidadSupabase[]> {
    return []
  }
}
