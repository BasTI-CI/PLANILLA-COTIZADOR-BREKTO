/**
 * Hooks de datos: stock vía `StockRepository` y UF vía API pública.
 * Mapeo BD → motor: `src/lib/stock` (reglas de cálculo: `src/lib/engines`).
 */
import { useState, useEffect } from 'react'
import {
  createDefaultStockRepository,
  filterUnidadesByTipologiaOpcional,
  filterUnidadesPorBusquedaNumero,
} from '@/lib/stock'
import { INMOBILIARIA_IMAGINA, PROYECTO_IMAGINA } from '@/lib/stock/imaginaPruebaRepository'
import { getTipologias } from '@/lib/tipologias'
import { getStock } from '@/lib/getStock'
import { isSupabaseConfigured } from '@/lib/supabase'

const stockRepo = createDefaultStockRepository()

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

export interface UseStockUnidadesParams {
  proyectoId: string | null
  inmobiliariaNombre: string | null
  proyectoNombre: string | null
  /** Texto libre de búsqueda por número/código de unidad (principal). */
  unidadBusqueda: string
  tipologiaOpcional: string
  catalogoTipologias: readonly string[]
  /** Si es false, no ejecuta consultas (p. ej. modo manual de cotización). */
  enabled?: boolean
}

// ─── Hook: Inmobiliarias (catálogo activo) ──────────────────────────
export function useInmobiliarias() {
  const [inmobiliarias, setInmobiliarias] = useState<Awaited<ReturnType<typeof stockRepo.listInmobiliarias>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchInmobiliarias() {
      setLoading(true)
      setError(null)
      try {
        const list = await stockRepo.listInmobiliarias()
        if (!cancelled) setInmobiliarias(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando inmobiliarias')
          setInmobiliarias([INMOBILIARIA_IMAGINA])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchInmobiliarias()
    return () => { cancelled = true }
  }, [])

  return { inmobiliarias, loading, error }
}

// ─── Hook: Proyectos por inmobiliaria (solo activos en repositorio) ─
export function useProyectosByInmobiliaria(inmobiliariaId: string | null) {
  const [proyectos, setProyectos] = useState<Awaited<ReturnType<typeof stockRepo.listProyectosByInmobiliaria>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!inmobiliariaId) {
      setProyectos([])
      setError(null)
      setLoading(false)
      return
    }
    const id = inmobiliariaId
    let cancelled = false
    async function fetchProyectos() {
      setLoading(true)
      setError(null)
      try {
        const list = await stockRepo.listProyectosByInmobiliaria(id)
        if (!cancelled) setProyectos(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando proyectos')
          setProyectos(id === INMOBILIARIA_IMAGINA.id ? [PROYECTO_IMAGINA] : [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchProyectos()
    return () => { cancelled = true }
  }, [inmobiliariaId])

  return { proyectos, loading, error }
}

// ─── Hook: listado plano de proyectos (compat) ───────────────────────
export function useProyectos() {
  const [proyectos, setProyectos] = useState<Awaited<ReturnType<typeof stockRepo.listProyectos>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchProyectos() {
      setLoading(true)
      setError(null)
      try {
        const list = await stockRepo.listProyectos()
        if (!cancelled) setProyectos(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando proyectos')
          setProyectos([PROYECTO_IMAGINA])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchProyectos()
    return () => { cancelled = true }
  }, [])

  return { proyectos, loading, error }
}

// ─── Hook: Unidades (get-stock + búsqueda por unidad; fallback repositorio) ─
export function useStockUnidades(params: UseStockUnidadesParams) {
  type U = Awaited<ReturnType<typeof stockRepo.listUnidadesByProyecto>>
  const [unidades, setUnidades] = useState<U>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    proyectoId,
    inmobiliariaNombre,
    proyectoNombre,
    unidadBusqueda,
    tipologiaOpcional,
    catalogoTipologias,
    enabled = true,
  } = params

  const debouncedUnidad = useDebouncedValue(unidadBusqueda.trim(), 360)
  const debouncePendiente =
    enabled &&
    Boolean(proyectoId && (inmobiliariaNombre?.trim() ?? '') && (proyectoNombre?.trim() ?? '')) &&
    unidadBusqueda.trim() !== debouncedUnidad

  const catalogoTipologiasKey = catalogoTipologias.join('|')

  useEffect(() => {
    if (!enabled) {
      console.info('[STOCK] skip consulta: enabled=false (p. ej. modo manual)')
      setUnidades([])
      setError(null)
      setLoading(false)
      return
    }

    const inm = inmobiliariaNombre?.trim() ?? ''
    const proy = proyectoNombre?.trim() ?? ''
    if (!proyectoId || !inm || !proy) {
      console.info('[STOCK] skip consulta: falta proyecto seleccionado o nombres inmobiliaria/proyecto', {
        proyectoId,
        inm,
        proy,
      })
      setUnidades([])
      setError(null)
      setLoading(false)
      return
    }

    const idProyecto = proyectoId
    const hayBusquedaUnidad = Boolean(debouncedUnidad.trim())
    /** Con búsqueda por unidad, no se mezcla filtro de tipología (UI también lo desactiva). */
    const tipologiaSoloSinBusquedaUnidad = hayBusquedaUnidad ? '' : tipologiaOpcional
    const tip = tipologiaSoloSinBusquedaUnidad.trim()
    const tipPayload = tip || undefined
    let cancelled = false

    async function fetchLocal(): Promise<U> {
      const list = await stockRepo.listUnidadesByProyecto(idProyecto)
      let next = filterUnidadesByTipologiaOpcional(list, tipologiaSoloSinBusquedaUnidad, catalogoTipologias)
      next = filterUnidadesPorBusquedaNumero(next, debouncedUnidad)
      return next
    }

    async function run() {
      setUnidades([])
      setLoading(true)
      setError(null)
      try {
        if (isSupabaseConfigured()) {
          console.info('[STOCK] disparo tras debounce → getStock (POST via SDK)', {
            inmobiliaria: inm,
            proyecto: proy,
            unidad: debouncedUnidad || '(vacío → query general)',
            tipologia: hayBusquedaUnidad ? '(omitida: hay búsqueda por unidad)' : (tipPayload ?? '(omitida)'),
          })
          try {
            const list = await getStock({
              inmobiliaria: inm,
              proyecto: proy,
              proyectoIdContext: idProyecto,
              limit: 200,
              ...(debouncedUnidad && { unidad: debouncedUnidad }),
              ...(tipPayload && { tipologia: tipPayload }),
            })
            if (!cancelled) {
              console.info('[STOCK] setState unidades ← getStock', { count: list.length })
              setUnidades(list as U)
            }
            return
          } catch (edgeErr) {
            console.error('[STOCK] get-stock falló; fallback repositorio local', edgeErr)
            if (cancelled) return
            const list = await fetchLocal()
            if (!cancelled) {
              console.info('[STOCK] setState unidades ← repositorio local (fallback)', list.length)
              setUnidades(list)
            }
            return
          }
        }
        console.info('[STOCK] Supabase no configurado → solo repositorio local (sin invoke)')
        const list = await fetchLocal()
        if (!cancelled) {
          console.info('[STOCK] setState unidades ← repositorio local', list.length)
          setUnidades(list)
        }
      } catch (err) {
        if (!cancelled) {
          setUnidades([])
          setError(err instanceof Error ? err.message : 'Error cargando unidades')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    enabled,
    proyectoId,
    inmobiliariaNombre,
    proyectoNombre,
    debouncedUnidad,
    tipologiaOpcional,
    catalogoTipologiasKey,
  ])

  const buscando =
    enabled && (loading || debouncePendiente) && Boolean(proyectoId && (inmobiliariaNombre?.trim() ?? '') && (proyectoNombre?.trim() ?? ''))

  return { unidades, loading, error, debouncePendiente, buscando }
}

// ─── Hook: Tipologías (Edge Function `get-tipologias`) ───────────────
export function useTipologias(inmobiliaria: string | null, proyecto: string | null) {
  const [tipologias, setTipologias] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const inm = inmobiliaria?.trim() ?? ''
    const proy = proyecto?.trim() ?? ''
    if (!inm || !proy) {
      setTipologias([])
      setError(null)
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured()) {
      setTipologias([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    async function fetchTipologias() {
      setLoading(true)
      setError(null)
      try {
        const list = await getTipologias(inm, proy)
        if (!cancelled) setTipologias(list)
      } catch {
        if (!cancelled) {
          setTipologias([])
          setError('No se pudieron cargar las tipologías')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchTipologias()
    return () => {
      cancelled = true
    }
  }, [inmobiliaria, proyecto])

  return { tipologias, loading, error }
}

// ─── Hook: UF del día (API Mindicador.cl) ──────────────────────────
const UF_FALLBACK = 39_836

export function useUF() {
  const [uf, setUF] = useState<number>(UF_FALLBACK)
  const [fecha, setFecha] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [esFallback, setEsFallback] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)   // 6s timeout

    async function fetchUF() {
      try {
        const res = await fetch('https://mindicador.cl/api/uf', {
          signal: controller.signal,
        })
        const data = await res.json()
        const valor: number | undefined = data?.serie?.[0]?.valor
        const fechaISO: string | undefined = data?.serie?.[0]?.fecha
        if (valor && valor > 0) {
          setUF(valor)
          if (fechaISO) {
            setFecha(new Date(fechaISO).toLocaleDateString('es-CL', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            }))
          }
        } else {
          setEsFallback(true)
        }
      } catch {
        setEsFallback(true)       // timeout o CORS → fallback silencioso
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }
    fetchUF()
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [])

  return { uf, fecha, loading, esFallback }
}
