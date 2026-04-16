import { describe, expect, it } from 'vitest'
import type { Cotizacion } from '@/types'
import { DEFAULT_DIVERSIFICACION, DEFAULT_HIPOTECARIO, DEFAULT_PIE, DEFAULT_PROMOCIONES, DEFAULT_RENTABILIDAD } from '@/types'
import { calcularIvaTotal, calcularDiversificacion } from './calculosDiversificacion'

function cotIva(escrituraUf: number, califica: boolean): Cotizacion {
  return {
    id: 0,
    activa: true,
    modo_fuente: 'manual',
    califica_iva: califica,
    mes_entrega_flujo: 10,
    propiedad: {
      proyecto_nombre: 'X',
      proyecto_comuna: 'C',
      proyecto_barrio: '',
      proyecto_direccion: '',
      unidad_numero: '1',
      unidad_tipologia: '1D1B',
      unidad_sup_interior_m2: 40,
      unidad_sup_terraza_m2: 0,
      unidad_sup_total_m2: 40,
      unidad_orientacion: 'S',
      unidad_entrega: '2026',
      precio_lista_uf: escrituraUf,
      descuento_uf: 0,
      precio_neto_uf: escrituraUf,
      bono_descuento_pct: 0,
      bono_max_pct: 0,
      bono_aplica_adicionales: false,
      estacionamiento_uf: 0,
      bodega_uf: 0,
      reserva_clp: 0,
    },
    pie: { ...DEFAULT_PIE, pie_pct: 0.1 },
    hipotecario: { ...DEFAULT_HIPOTECARIO, hipotecario_aprobacion_pct: 0.9 },
    rentabilidad: { ...DEFAULT_RENTABILIDAD },
    promociones: { ...DEFAULT_PROMOCIONES },
  }
}

describe('calcularIvaTotal', () => {
  it('15% del valor escrituración en CLP solo si activa y califica_iva', () => {
    const uf = 1000
    const cots = [cotIva(100, true), { ...cotIva(200, false), id: 1, activa: true }]
    const total = calcularIvaTotal(cots, uf)
    expect(total).toBe(100 * 0.15 * uf)
  })
})

describe('calcularDiversificacion', () => {
  it('sin mes de entrega definido: no inyecta IVA automático (hasta indicar M entrega)', () => {
    const uf = 1000
    const cot = { ...cotIva(100, true), mes_entrega_flujo: null }
    const tabla = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [cot], uf)
    expect(tabla.every((f) => f.iva_inyeccion === 0)).toBe(true)
  })

  it('inyecta IVA solo en mes_entrega + 5', () => {
    const uf = 1000
    const cot = cotIva(100, true)
    const datos = {
      ...DEFAULT_DIVERSIFICACION,
      diversif_iva_manual_override: true,
      diversif_iva_total_clp: 50_000,
    }
    const tabla = calcularDiversificacion(datos, [cot], uf)
    const mesIva = 15
    const filaIva = tabla.find((f) => f.iva_inyeccion > 0)
    expect(filaIva?.mes).toBe(mesIva)
    expect(tabla.filter((f) => f.iva_inyeccion > 0)).toHaveLength(1)
  })
})
