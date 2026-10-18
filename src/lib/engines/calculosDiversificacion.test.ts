import { describe, expect, it } from 'vitest'
import type { Cotizacion } from '@/types'
import { DEFAULT_DIVERSIFICACION, DEFAULT_HIPOTECARIO, DEFAULT_PIE, DEFAULT_PROMOCIONES, DEFAULT_RENTABILIDAD } from '@/types'
import {
  calcularIvaTotal,
  calcularDiversificacion,
  devolucionIvaCotizacionClp,
  arriendoFlujoUnidadMes,
} from './calculosDiversificacion'
import { devolucionIvaPrecioDeptoClp } from './precioCompra'
import { calcularResultadosCotizacion } from './calculosCotizacion'

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

// ── B-07 · Flujo con arriendo garantizado (§3.5.1) ────────────────
const UF = 1000

function cotAg(
  opts: { agOn?: boolean; agMeses?: number; entrega?: number | null; tipo?: 'larga' | 'corta' } = {}
): Cotizacion {
  const { agOn = true, agMeses = 24, entrega = 12, tipo = 'larga' } = opts
  const base = cotIva(100, false)
  return {
    ...base,
    mes_entrega_flujo: entrega,
    rentabilidad: {
      ...base.rentabilidad,
      tipo_renta: tipo,
      arriendo_mensual_clp: 300_000,
      arriendo_garantizado_clp: 400_000,
      ag_meses: agMeses,
      airbnb_valor_dia_clp: 30_000,
    },
    promociones: { ...base.promociones, arriendo_garantizado: agOn },
  }
}

describe('arriendoFlujoUnidadMes (B-07)', () => {
  it('AG en j=1..N; mercado desde N+1', () => {
    const r = calcularResultadosCotizacion(cotAg(), UF)
    expect(arriendoFlujoUnidadMes(r, 1)).toBe(400_000)
    expect(arriendoFlujoUnidadMes(r, 24)).toBe(400_000)
    expect(arriendoFlujoUnidadMes(r, 25)).toBe(300_000)
  })

  it('j < 1 → 0', () => {
    const r = calcularResultadosCotizacion(cotAg(), UF)
    expect(arriendoFlujoUnidadMes(r, 0)).toBe(0)
  })

  it('booleano apagado con ag_meses cargado → mercado', () => {
    const r = calcularResultadosCotizacion(cotAg({ agOn: false }), UF)
    expect(arriendoFlujoUnidadMes(r, 1)).toBe(300_000)
  })

  it('booleano encendido con ag_meses=0 → mercado', () => {
    const r = calcularResultadosCotizacion(cotAg({ agMeses: 0 }), UF)
    expect(arriendoFlujoUnidadMes(r, 1)).toBe(300_000)
    expect(arriendoFlujoUnidadMes(r, 30)).toBe(300_000)
  })

  it('renta corta ignora AG → neto renta corta', () => {
    const r = calcularResultadosCotizacion(cotAg({ tipo: 'corta' }), UF)
    expect(r.arriendo.ingreso_neto_flujo_clp).not.toBe(400_000)
    expect(arriendoFlujoUnidadMes(r, 1)).toBe(r.arriendo.ingreso_neto_flujo_clp)
  })
})

describe('calcularDiversificacion con AG (B-07)', () => {
  it('E=12, N=24: 1–12 → 0; 13–36 → D−AG; 37–60 → D−mercado', () => {
    const c = cotAg()
    const D = calcularResultadosCotizacion(c, UF).hipotecario.dividendo_total_clp
    const t = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [c], UF)
    for (const f of t) {
      const esperado =
        f.mes <= 12 ? 0 : f.mes <= 36 ? Math.round(D - 400_000) : Math.round(D - 300_000)
      expect(f.dividendo_menos_arriendo_clp).toBe(esperado)
    }
  })

  it('regresión: booleano apagado con ag_meses=24 = defaults B-08', () => {
    const conAgCargado = cotAg({ agOn: false })
    const base = cotIva(100, false)
    const defaults: Cotizacion = {
      ...base,
      mes_entrega_flujo: 12,
      rentabilidad: { ...base.rentabilidad, arriendo_mensual_clp: 300_000 },
    }
    expect(calcularDiversificacion(DEFAULT_DIVERSIFICACION, [conAgCargado], UF)).toEqual(
      calcularDiversificacion(DEFAULT_DIVERSIFICACION, [defaults], UF)
    )
  })

  it('corte en 60: E=48, N=24 → AG en 49–60', () => {
    const c = cotAg({ entrega: 48 })
    const D = calcularResultadosCotizacion(c, UF).hipotecario.dividendo_total_clp
    const t = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [c], UF)
    expect(t).toHaveLength(60)
    const conAg = t.filter((f) => f.dividendo_menos_arriendo_clp === Math.round(D - 400_000))
    expect(conAg.map((f) => f.mes)).toEqual(Array.from({ length: 12 }, (_, i) => 49 + i))
  })

  it('sin mes de entrega: div−arr = 0 en los 60 meses', () => {
    const t = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [cotAg({ entrega: null })], UF)
    expect(t.every((f) => f.dividendo_menos_arriendo_clp === 0)).toBe(true)
  })

  it('dos unidades: div−arr = suma de cada una por separado', () => {
    const a = cotAg()
    const b = { ...cotAg({ agOn: false, entrega: 20 }), id: 1 }
    const ta = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [a], UF)
    const tb = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [b], UF)
    const tab = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [a, b], UF)
    tab.forEach((f, i) => {
      expect(f.dividendo_menos_arriendo_clp).toBe(
        ta[i].dividendo_menos_arriendo_clp + tb[i].dividendo_menos_arriendo_clp
      )
    })
  })
})
