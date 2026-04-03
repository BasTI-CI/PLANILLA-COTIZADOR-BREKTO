import { describe, expect, it } from 'vitest'
import type { Cotizacion } from '@/types'
import { DEFAULT_HIPOTECARIO, DEFAULT_PIE, DEFAULT_RENTABILIDAD } from '@/types'
import { calcularResultadosCotizacion } from './calculosCotizacion'
import {
  recomputarValorEscrituraUf,
  recomputarValorTasacionUf,
  validarResultadosCotizacion,
} from './validarCalculosCotizacion'

function cotBase(): Cotizacion {
  return {
    id: 0,
    activa: true,
    modo_fuente: 'manual',
    califica_iva: false,
    propiedad: {
      proyecto_nombre: 'T',
      proyecto_comuna: 'C',
      proyecto_barrio: '',
      proyecto_direccion: '',
      unidad_numero: '1',
      unidad_tipologia: '2D2B',
      unidad_sup_interior_m2: 50,
      unidad_sup_terraza_m2: 0,
      unidad_sup_total_m2: 50,
      unidad_orientacion: 'N',
      unidad_entrega: '2026',
      precio_lista_uf: 1000,
      descuento_uf: 100,
      precio_neto_uf: 900,
      bono_descuento_pct: 0.1,
      bono_max_pct: 0.05,
      bono_aplica_adicionales: true,
      estacionamiento_uf: 20,
      bodega_uf: 10,
      reserva_clp: 0,
    },
    pie: { ...DEFAULT_PIE, pie_pct: 0.2 },
    hipotecario: { ...DEFAULT_HIPOTECARIO, hipotecario_aprobacion_pct: 0.8 },
    rentabilidad: { ...DEFAULT_RENTABILIDAD },
  }
}

describe('recomputar*', () => {
  it('tasación y escritura coinciden con fórmula manual', () => {
    const p = cotBase().propiedad
    const tas = recomputarValorTasacionUf(p)
    expect(tas).toBeCloseTo(900 / 0.9, 6)
    const esc = recomputarValorEscrituraUf(p)
    const adic = 20 / 0.9 + 10 / 0.9
    expect(esc).toBeCloseTo(tas + adic, 6)
  })
})

describe('validarResultadosCotizacion', () => {
  it('motor pasa validación completa (caso variado)', () => {
    const cot = cotBase()
    const r = calcularResultadosCotizacion(cot, 37_000)
    const v = validarResultadosCotizacion(cot, r)
    expect(v.ok, v.fallos.map((f) => f.mensaje).join('; ')).toBe(true)
  })

  it('falla si pie + LTV ≠ 100%', () => {
    const cot = cotBase()
    cot.hipotecario.hipotecario_aprobacion_pct = 0.75
    const r = calcularResultadosCotizacion(cot, 37_000)
    const v = validarResultadosCotizacion(cot, r)
    expect(v.ok).toBe(false)
    expect(v.fallos.some((f) => f.id === 'pie_mas_ltv')).toBe(true)
  })

  it('falla si lista − descuento ≠ neto', () => {
    const cot = cotBase()
    cot.propiedad.precio_neto_uf = 1
    const r = calcularResultadosCotizacion(cot, 37_000)
    const v = validarResultadosCotizacion(cot, r)
    expect(v.ok).toBe(false)
    expect(v.fallos.some((f) => f.id === 'lista_menos_descuento_neto')).toBe(true)
  })
})
