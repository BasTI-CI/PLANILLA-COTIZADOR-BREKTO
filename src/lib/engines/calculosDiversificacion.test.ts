import { describe, expect, it } from 'vitest'
import type { Cotizacion } from '@/types'
import { DEFAULT_DIVERSIFICACION, DEFAULT_HIPOTECARIO, DEFAULT_PIE, DEFAULT_PROMOCIONES, DEFAULT_RENTABILIDAD } from '@/types'
import { calcularIvaTotal, calcularDiversificacion, arriendoFlujoUnidadMes } from './calculosDiversificacion'
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
