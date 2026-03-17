import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProyectoSupabase, UnidadSupabase } from '@/types'

// ─── Tipo real de la tabla Stock_Imagina_Prueba ─────────────────────
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

// Proyecto sintético (la tabla no tiene proyectos separados)
const PROYECTO_IMAGINA: ProyectoSupabase = {
  id: 'imagina',
  nombre: 'Imagina',
  comuna: 'Santiago',
  barrio: '',
  direccion: '',
  inmobiliaria: 'Imagina Inmobiliaria',
}

function rowToUnidad(row: StockRow): UnidadSupabase {
  return {
    id: String(row.id),
    proyecto_id: 'imagina',
    numero: String(row.depto),
    tipologia: row.modelo,
    sup_interior_m2: row.sup_int,
    sup_terraza_m2: row.sup_terr,
    sup_total_m2: row.sup_total,
    orientacion: row.orientacion,
    entrega: 'A convenir',
    precio_lista_uf: row.precio,
    descuento_uf: Math.round((row.precio - row.precio_dcto) * 100) / 100,
    precio_compra_uf: row.precio_dcto,
    bono_descuento_pct: row.dcto,
    bono_max_pct: row.bono10,          // bono10 = bono máximo
    pie_pct: 0.20,                     // default 20% (ajustar cuando se tenga dato real)
    estacionamiento_uf: 0,
    bodega_uf: 0,
    disponible: true,
  }
}

// ─── Fallback mock (si Supabase no responde) ──────────────────────
const MOCK_PROYECTOS: ProyectoSupabase[] = [PROYECTO_IMAGINA]

// ─── Hook: Proyectos — retorna el proyecto Imagina ─────────────────
export function useProyectos() {
  const [proyectos, setProyectos] = useState<ProyectoSupabase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProyectos() {
      try {
        // Verificamos que la tabla exista consultando 1 fila
        const { error: err } = await supabase
          .from(TABLA)
          .select('id')
          .limit(1)

        if (err) throw err
        // Si la tabla existe, exponemos el proyecto Imagina
        setProyectos([PROYECTO_IMAGINA])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando proyectos')
        setProyectos(MOCK_PROYECTOS)   // silently fallback
      } finally {
        setLoading(false)
      }
    }
    fetchProyectos()
  }, [])

  return { proyectos, loading, error }
}

// ─── Hook: Unidades por proyecto ───────────────────────────────────
// proyectoId = 'imagina' → trae todos los registros de Stock_Imagina_Prueba
export function useUnidades(proyectoId: string | null) {
  const [unidades, setUnidades] = useState<UnidadSupabase[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!proyectoId) { setUnidades([]); return }

    async function fetchUnidades() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from(TABLA)
          .select('*')
          .order('depto', { ascending: true })

        if (error) throw error
        setUnidades((data as StockRow[]).map(rowToUnidad))
      } catch {
        setUnidades([])
      } finally {
        setLoading(false)
      }
    }
    fetchUnidades()
  }, [proyectoId])

  return { unidades, loading }
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
            // Converter ISO → "15/03/2026"
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
