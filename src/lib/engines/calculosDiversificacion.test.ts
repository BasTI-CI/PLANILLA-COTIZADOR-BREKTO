import { describe, expect, it } from 'vitest'
import type { Cotizacion } from '@/types'
import { DEFAULT_DIVERSIFICACION, DEFAULT_HIPOTECARIO, DEFAULT_PIE, DEFAULT_PROMOCIONES, DEFAULT_RENTABILIDAD } from '@/types'
import { calcularIvaTotal, calcularDiversificacion, devolucionIvaCotizacionClp } from './calculosDiversificacion'
import { devolucionIvaPrecioDeptoClp } from './precioCompra'

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

describe('devolucionIvaCotizacionClp (B-05)', () => {
  const uf = 1000
  const manual = (total: number) => ({
    ...DEFAULT_DIVERSIFICACION,
    diversif_iva_manual_override: true,
    diversif_iva_total_clp: total,
  })

  /** Suma, por mes 1..60, lo que el helper asigna a las unidades cuyo mes IVA cae en ese mes. */
  function ivaPorMesSegunHelper(cots: Cotizacion[], datos: typeof DEFAULT_DIVERSIFICACION) {
    const porMes = new Map<number, number>()
    for (const c of cots) {
      if (!c.activa || !c.califica_iva || c.mes_entrega_flujo == null) continue
      const mIva = c.mes_entrega_flujo + 5
      if (mIva < 1 || mIva > 60) continue
      const v = devolucionIvaCotizacionClp(c, cots, datos, uf) ?? 0
      porMes.set(mIva, (porMes.get(mIva) ?? 0) + v)
    }
    return porMes
  }

  function expectInvariante(cots: Cotizacion[], datos: typeof DEFAULT_DIVERSIFICACION) {
    const tabla = calcularDiversificacion(datos, cots, uf)
    const porMes = ivaPorMesSegunHelper(cots, datos)
    for (const f of tabla) {
      expect(f.iva_inyeccion).toBe(porMes.get(f.mes) ?? 0)
    }
  }

  it('inactiva o que no califica → null', () => {
    const inactiva = { ...cotIva(100, true), activa: false }
    const noCalifica = cotIva(100, false)
    expect(devolucionIvaCotizacionClp(inactiva, [inactiva], DEFAULT_DIVERSIFICACION, uf)).toBeNull()
    expect(devolucionIvaCotizacionClp(noCalifica, [noCalifica], DEFAULT_DIVERSIFICACION, uf)).toBeNull()
    expect(devolucionIvaCotizacionClp(noCalifica, [noCalifica], manual(50_000), uf)).toBeNull()
  })

  it('automático = devolucionIvaPrecioDeptoClp, aunque no tenga mes de entrega', () => {
    const c = cotIva(100, true)
    expect(devolucionIvaCotizacionClp(c, [c], DEFAULT_DIVERSIFICACION, uf)).toBe(
      devolucionIvaPrecioDeptoClp(c.propiedad, uf)
    )
    const sinMes = { ...c, mes_entrega_flujo: null }
    expect(devolucionIvaCotizacionClp(sinMes, [sinMes], DEFAULT_DIVERSIFICACION, uf)).toBe(
      devolucionIvaPrecioDeptoClp(c.propiedad, uf)
    )
  })

  it('manual con 2 unidades que califican → proporcional y suma el total manual (±1)', () => {
    const a = cotIva(100, true)
    const b = { ...cotIva(233, true), id: 1, mes_entrega_flujo: 20 }
    const otra = { ...cotIva(400, false), id: 2 }
    const cots = [a, b, otra]
    const datos = manual(1_000_001)
    const va = devolucionIvaCotizacionClp(a, cots, datos, uf) as number
    const vb = devolucionIvaCotizacionClp(b, cots, datos, uf) as number
    expect(Math.abs(va + vb - 1_000_001)).toBeLessThanOrEqual(1)
    expect(va / vb).toBeCloseTo(100 / 233, 4)
    expect(devolucionIvaCotizacionClp(otra, cots, datos, uf)).toBeNull()
  })

  it('invariante: iva_inyeccion del flujo = suma de helpers del mes (automático)', () => {
    const a = cotIva(100, true)
    const b = { ...cotIva(233, true), id: 1, mes_entrega_flujo: 20 }
    const c = { ...cotIva(150, true), id: 2, mes_entrega_flujo: 10 }
    const d = { ...cotIva(150, true), id: 3, mes_entrega_flujo: 58 }
    expectInvariante([a, b, c, d], DEFAULT_DIVERSIFICACION)
  })

  it('invariante: iva_inyeccion del flujo = suma de helpers del mes (manual prorrateado)', () => {
    const a = cotIva(100, true)
    const b = { ...cotIva(233, true), id: 1, mes_entrega_flujo: 20 }
    const c = { ...cotIva(150, true), id: 2, mes_entrega_flujo: 10 }
    const d = { ...cotIva(150, true), id: 3, mes_entrega_flujo: 58 }
    expectInvariante([a, b, c, d], manual(7_777_777))
  })

  it('manual sin base (totalShares <= 0): el total va a la unidad del primer mes IVA en 1..60', () => {
    const tarde = { ...cotIva(0, true), id: 0, mes_entrega_flujo: 30 }
    const temprana = { ...cotIva(0, true), id: 1, mes_entrega_flujo: 5 }
    const empate = { ...cotIva(0, true), id: 2, mes_entrega_flujo: 5 }
    const fuera = { ...cotIva(0, true), id: 3, mes_entrega_flujo: 70 }
    const cots = [tarde, temprana, empate, fuera]
    const datos = manual(3_000_000.4)
    expect(devolucionIvaCotizacionClp(temprana, cots, datos, uf)).toBe(3_000_000)
    expect(devolucionIvaCotizacionClp(empate, cots, datos, uf)).toBe(0)
    expect(devolucionIvaCotizacionClp(tarde, cots, datos, uf)).toBe(0)
    expect(devolucionIvaCotizacionClp(fuera, cots, datos, uf)).toBe(0)
    expectInvariante(cots, datos)
  })

  it('manual sin base y ninguna unidad con mes IVA en 1..60 → 0 para todas', () => {
    const a = { ...cotIva(0, true), mes_entrega_flujo: null }
    const b = { ...cotIva(0, true), id: 1, mes_entrega_flujo: 60 }
    const cots = [a, b]
    const datos = manual(3_000_000)
    expect(devolucionIvaCotizacionClp(a, cots, datos, uf)).toBe(0)
    expect(devolucionIvaCotizacionClp(b, cots, datos, uf)).toBe(0)
    expectInvariante(cots, datos)
  })
})
