import { describe, it, expect } from 'vitest'
import { validateUnidadSupabaseForMotor } from './validateStockInputs'
import { unidadSupabaseToDatosPropiedad } from './mapToDatosPropiedad'
import type { ProyectoSupabase, UnidadSupabase } from '@/types'

const proyecto: ProyectoSupabase = {
  id: 'p1',
  nombre: 'Test',
  comuna: 'Stgo',
  barrio: '',
  direccion: '',
}

function baseUnidad(over: Partial<UnidadSupabase> = {}): UnidadSupabase {
  return {
    id: '1',
    proyecto_id: 'p1',
    numero: '101',
    tipologia: '2D2B',
    sup_interior_m2: 50,
    sup_terraza_m2: 5,
    sup_total_m2: 55,
    orientacion: 'N',
    entrega: '2026',
    precio_lista_uf: 100,
    descuento_uf: 10,
    precio_neto_uf: 90,
    bono_descuento_pct: 0.1,
    bono_max_pct: 0,
    bono_aplica_adicionales: false,
    pie_pct: 0.2,
    estacionamiento_uf: 0,
    bodega_uf: 0,
    disponible: true,
    ...over,
  }
}

describe('validateUnidadSupabaseForMotor', () => {
  it('acepta unidad coherente', () => {
    const r = validateUnidadSupabaseForMotor(baseUnidad())
    expect(r.ok).toBe(true)
    expect(r.issues).toHaveLength(0)
  })

  it('detecta neto mayor que lista', () => {
    const r = validateUnidadSupabaseForMotor(
      baseUnidad({ precio_lista_uf: 80, precio_neto_uf: 90, descuento_uf: 0 })
    )
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.code === 'neto_vs_lista')).toBe(true)
  })

  it('detecta % fuera de rango', () => {
    const r = validateUnidadSupabaseForMotor(baseUnidad({ bono_descuento_pct: 1.5 }))
    expect(r.ok).toBe(false)
  })
})

describe('unidadSupabaseToDatosPropiedad', () => {
  it('arma DatosPropiedad con reserva por defecto', () => {
    const d = unidadSupabaseToDatosPropiedad(proyecto, baseUnidad())
    expect(d.proyecto_nombre).toBe('Test')
    expect(d.precio_neto_uf).toBe(90)
    expect(d.reserva_clp).toBe(100_000)
  })
})
