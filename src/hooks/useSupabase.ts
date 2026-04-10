/**
 * Hooks de datos: stock vía `StockRepository` y UF vía API pública.
 * Mapeo BD → motor: `src/lib/stock` (reglas de cálculo: `src/lib/engines`).
 */
import { useState, useEffect } from 'react'
import { createDefaultStockRepository } from '@/lib/stock'
import { PROYECTO_IMAGINA } from '@/lib/stock/imaginaPruebaRepository'

const stockRepo = createDefaultStockRepository()

// ─── Hook: Proyectos ───────────────────────────────────────────────
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

// ─── Hook: Unidades por proyecto ───────────────────────────────────
export function useUnidades(proyectoId: string | null) {
  const [unidades, setUnidades] = useState<Awaited<ReturnType<typeof stockRepo.listUnidadesByProyecto>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!proyectoId) {
      setUnidades([])
      setError(null)
      return
    }
    const idProyecto = proyectoId
    let cancelled = false
    async function fetchUnidades() {
      setLoading(true)
      setError(null)
      try {
        const list = await stockRepo.listUnidadesByProyecto(idProyecto)
        if (!cancelled) setUnidades(list)
      } catch (err) {
        if (!cancelled) {
          setUnidades([])
          setError(err instanceof Error ? err.message : 'Error cargando unidades')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchUnidades()
    return () => { cancelled = true }
  }, [proyectoId])

  return { unidades, loading, error }
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
