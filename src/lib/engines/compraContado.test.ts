import { describe, expect, it } from 'vitest'
import type { Cotizacion } from '@/types'
import {
  DEFAULT_DIVERSIFICACION,
  DEFAULT_HIPOTECARIO,
  DEFAULT_PIE,
  DEFAULT_PROMOCIONES,
  DEFAULT_RENTABILIDAD,
} from '@/types'
import { calcularResultadosCotizacion } from './calculosCotizacion'
import { calcularDiversificacion } from './calculosDiversificacion'
import { calcularMontosDesglosePieClp } from './calculosPie'
import { cotizacionEfectiva, esCompraContado } from './compraContado'
import { bonoPieUf, pieAPagarUf } from './desglosePieUf'
import { validarResultadosCotizacion } from './validarCalculosCotizacion'

const UF = 37_000

/** BI 0, cuotas antes/después, cuotón y crédito 80 %. */
function cotBase(): Cotizacion {
  return {
    id: 0,
    activa: true,
    modo_fuente: 'manual',
    califica_iva: false,
    mes_entrega_flujo: 24,
    propiedad: {
      proyecto_nombre: 'T',
      proyecto_comuna: 'C',
      proyecto_barrio: '',
      proyecto_direccion: '',
      unidad_numero: '101',
      unidad_tipologia: '2D2B',
      unidad_sup_interior_m2: 50,
      unidad_sup_terraza_m2: 0,
      unidad_sup_total_m2: 50,
      unidad_orientacion: 'N',
      unidad_entrega: '2028',
      precio_lista_uf: 4000,
      descuento_uf: 200,
      precio_neto_uf: 3800,
      bono_descuento_pct: 0,
      bono_max_pct: 0.05,
      bono_aplica_adicionales: false,
      estacionamiento_uf: 300,
      bodega_uf: 80,
      reserva_clp: 0,
    },
    pie: {
      ...DEFAULT_PIE,
      pie_pct: 0.2,
      upfront_pct: 0.02,
      cuotas_antes_entrega_pct: 0.08,
      cuotas_antes_entrega_n: 20,
      cuotas_despues_entrega_pct: 0.05,
      cuotas_despues_entrega_n: 10,
      cuoton_pct: 0.03,
      cuoton_n_cuotas: 3,
      pie_n_cuotas_total: 33,
    },
    hipotecario: { ...DEFAULT_HIPOTECARIO, hipotecario_aprobacion_pct: 0.8 },
    rentabilidad: { ...DEFAULT_RENTABILIDAD, tipo_renta: 'larga', arriendo_mensual_clp: 500_000 },
    promociones: { ...DEFAULT_PROMOCIONES },
  }
}

function contado(c: Cotizacion): Cotizacion {
  return { ...c, compra_contado: true }
}

/** Caso j/k: BI 10 %, est y bod > 0, BI repercute en adicionales. */
function cotConBi(): Cotizacion {
  const c = cotBase()
  c.propiedad.bono_descuento_pct = 0.1
  c.propiedad.bono_aplica_adicionales = true
  return c
}

describe('compra contado (B-04)', () => {
  it('a. sin crédito, dividendo ni tabla', () => {
    const r = calcularResultadosCotizacion(contado(cotBase()), UF)
    expect(r.hipotecario.monto_credito_uf).toBe(0)
    expect(r.hipotecario.monto_credito_clp).toBe(0)
    expect(r.hipotecario.dividendo_capital_uf).toBe(0)
    expect(r.hipotecario.dividendo_total_uf).toBe(0)
    expect(r.hipotecario.dividendo_total_clp).toBe(0)
    expect(r.hipotecario.tabla_amortizacion).toEqual([])
  })

  it('b. pie total = valor escrituración', () => {
    const r = calcularResultadosCotizacion(contado(cotBase()), UF)
    expect(r.pie_total_uf).toBeCloseTo(r.valor_escritura_uf, 9)
  })

  it('c. bono pie 0 y pie a pagar = escrituración', () => {
    const c = contado(cotBase())
    const ce = cotizacionEfectiva(c)
    const r = calcularResultadosCotizacion(c, UF)
    expect(bonoPieUf(r.valor_escritura_uf, ce.pie)).toBe(0)
    expect(pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, ce.pie)).toBeCloseTo(
      r.valor_escritura_uf,
      9
    )
  })

  it('d. desglose CLP: todo en upfront', () => {
    const c = contado(cotBase())
    const r = calcularResultadosCotizacion(c, UF)
    const mp = calcularMontosDesglosePieClp(r.valor_escritura_uf, cotizacionEfectiva(c).pie, UF)
    expect(mp.monto_upfront_clp).toBe(Math.round(r.valor_escritura_uf * UF))
    expect(mp.monto_cuota_antes_clp).toBe(0)
    expect(mp.monto_cuota_despues_clp).toBe(0)
    expect(mp.monto_cuoton_clp).toBe(0)
  })

  it('e. validador ok', () => {
    const c = contado(cotBase())
    const r = calcularResultadosCotizacion(c, UF)
    const v = validarResultadosCotizacion(c, r)
    expect(v.ok, v.fallos.map((f) => f.mensaje).join('; ')).toBe(true)
  })

  it('f. flujo 60m: pie solo en mes 1; post-entrega dividendo − arriendo = −arriendo', () => {
    const c = contado(cotBase())
    const r = calcularResultadosCotizacion(c, UF)
    const tabla = calcularDiversificacion(DEFAULT_DIVERSIFICACION, [c], UF)
    expect(tabla[0].egreso_pie_clp).toBe(Math.round(r.valor_escritura_uf * UF))
    for (const f of tabla.slice(1)) expect(f.egreso_pie_clp).toBe(0)
    const entrega = c.mes_entrega_flujo as number
    for (const f of tabla) {
      if (f.mes <= entrega) expect(f.dividendo_menos_arriendo_clp).toBe(0)
      else expect(f.dividendo_menos_arriendo_clp).toBe(-r.arriendo.ingreso_neto_flujo_clp)
    }
  })

  it('g. compra_contado false = sin el campo', () => {
    const sin = cotBase()
    const conFalse = { ...cotBase(), compra_contado: false }
    expect(calcularResultadosCotizacion(conFalse, UF)).toEqual(
      calcularResultadosCotizacion(sin, UF)
    )
    expect(calcularDiversificacion(DEFAULT_DIVERSIFICACION, [conFalse], UF)).toEqual(
      calcularDiversificacion(DEFAULT_DIVERSIFICACION, [sin], UF)
    )
  })

  it('h. undefined se comporta como false', () => {
    const c = cotBase()
    expect(c.compra_contado).toBeUndefined()
    expect(esCompraContado(c)).toBe(false)
    expect(cotizacionEfectiva(c)).toBe(c)
    expect(calcularResultadosCotizacion(c, UF).hipotecario.monto_credito_uf).toBeGreaterThan(0)
  })

  it('i. ganancia venta = precio venta 5 años', () => {
    const r = calcularResultadosCotizacion(contado(cotBase()), UF)
    expect(r.plusvalia.ganancia_venta_uf).toBeCloseTo(r.plusvalia.precio_venta_5anos_uf, 2)
  })

  it('j. con BI > 0, contado anula el BI: escritura = precio compra total', () => {
    const c = contado(cotConBi())
    const r = calcularResultadosCotizacion(c, UF)
    expect(r.valor_escritura_uf).toBeCloseTo(r.precio_compra_total_uf, 9)
    expect(r.beneficio_inmobiliario_uf).toBe(0)
    expect(r.pie_total_uf).toBeCloseTo(r.precio_compra_total_uf, 9)
    const v = validarResultadosCotizacion(c, r)
    expect(v.ok, v.fallos.map((f) => f.mensaje).join('; ')).toBe(true)
  })

  it('k. el mismo caso sin contado conserva el BI', () => {
    const c = cotConBi()
    const r = calcularResultadosCotizacion(c, UF)
    const tas = (3800 * 0.95) / 0.9
    expect(r.valor_tasacion_uf).toBeCloseTo(tas, 9)
    expect(r.valor_escritura_uf).toBeCloseTo(tas + 300 / 0.9 + 80 / 0.9, 9)
    expect(r.beneficio_inmobiliario_uf).toBeCloseTo(tas * 0.1, 9)
    expect(r.valor_escritura_uf).toBeGreaterThan(r.precio_compra_total_uf)
    expect(r.hipotecario.monto_credito_uf).toBeCloseTo(r.valor_escritura_uf * 0.8, 9)
  })

  it('l. cotizacionEfectiva no muta la entrada', () => {
    const c = contado(cotConBi())
    const antes = structuredClone(c)
    const ce = cotizacionEfectiva(c)
    expect(c).toEqual(antes)
    expect(ce).not.toBe(c)
    expect(ce.propiedad.bono_descuento_pct).toBe(0)
    expect(ce.pie.pie_pct).toBe(1)
    expect(ce.hipotecario.hipotecario_aprobacion_pct).toBe(0)
    const normal = cotBase()
    expect(cotizacionEfectiva(normal)).toBe(normal)
  })
})
