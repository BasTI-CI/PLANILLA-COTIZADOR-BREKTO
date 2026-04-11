import { describe, expect, it } from 'vitest'
import type { Cotizacion } from '@/types'
import { DEFAULT_HIPOTECARIO, DEFAULT_PIE, DEFAULT_RENTABILIDAD } from '@/types'
import {
  calcularArriendo,
  calcularHipotecario,
  calcularPlusvalia,
  calcularResultadosCotizacion,
  valorTasacionDeptoUf,
} from './calculosCotizacion'
import { validarResultadosCotizacion } from './validarCalculosCotizacion'

function cotEjemploPlanilla(): Cotizacion {
  return {
    id: 0,
    activa: true,
    modo_fuente: 'manual',
    califica_iva: true,
    mes_entrega_flujo: 37,
    propiedad: {
      proyecto_nombre: 'Test',
      proyecto_comuna: 'Stgo',
      proyecto_barrio: '',
      proyecto_direccion: '',
      unidad_numero: '210',
      unidad_tipologia: '2D2B',
      unidad_sup_interior_m2: 55.61,
      unidad_sup_terraza_m2: 0,
      unidad_sup_total_m2: 55.61,
      unidad_orientacion: 'N',
      unidad_entrega: '2026',
      precio_lista_uf: 3988,
      descuento_uf: 1106.67,
      precio_neto_uf: 2881.33,
      bono_descuento_pct: 0.15,
      bono_max_pct: 0,
      bono_aplica_adicionales: false,
      estacionamiento_uf: 0,
      bodega_uf: 0,
      reserva_clp: 100_000,
    },
    pie: { ...DEFAULT_PIE, pie_pct: 0.2 },
    hipotecario: { ...DEFAULT_HIPOTECARIO, hipotecario_aprobacion_pct: 0.8 },
    rentabilidad: { ...DEFAULT_RENTABILIDAD },
  }
}

describe('calcularResultadosCotizacion', () => {
  const uf = 39_841.72

  it('tasación = precio_neto / (1 - beneficio); pie + crédito = escritura con LTV 80% y pie 20%', () => {
    const cot = cotEjemploPlanilla()
    const r = calcularResultadosCotizacion(cot, uf)
    expect(r.precio_compra_total_uf).toBeCloseTo(2881.33, 2)
    const esperadoTasacion = 2881.33 / (1 - 0.15)
    expect(r.valor_tasacion_uf).toBeCloseTo(esperadoTasacion, 2)
    expect(r.valor_escritura_uf).toBeCloseTo(esperadoTasacion, 2)
    expect(r.beneficio_inmobiliario_uf).toBeCloseTo(r.valor_tasacion_uf * 0.15, 2)
    expect(r.pie_total_uf).toBeCloseTo(r.valor_escritura_uf * 0.2, 2)
    expect(r.hipotecario.monto_credito_uf).toBeCloseTo(r.valor_escritura_uf * 0.8, 2)
    expect(r.pie_total_uf + r.hipotecario.monto_credito_uf).toBeCloseTo(
      r.valor_escritura_uf,
      2
    )
  })

  it('sin adicionales: tasación = neto×(1−b_max)÷(1−b_desc) con ambos %', () => {
    const cot = cotEjemploPlanilla()
    cot.propiedad.bono_max_pct = 0.1
    const r = calcularResultadosCotizacion(cot, uf)
    const tas = (2881.33 * 0.9) / 0.85
    expect(r.valor_tasacion_uf).toBeCloseTo(tas, 2)
    expect(r.valor_escritura_uf).toBeCloseTo(tas, 2)
  })

  it('con adicionales: escrituración = tasación + estac./bodega en escritura (÷(1−beneficio) si aplica)', () => {
    const cot = cotEjemploPlanilla()
    cot.propiedad.bono_max_pct = 0.1
    cot.propiedad.estacionamiento_uf = 100
    cot.propiedad.bono_aplica_adicionales = false
    const tas = (2881.33 * 0.9) / 0.85
    const r1 = calcularResultadosCotizacion(cot, uf)
    expect(r1.valor_escritura_uf).toBeCloseTo(tas + 100, 2)

    cot.propiedad.bono_aplica_adicionales = true
    const r2 = calcularResultadosCotizacion(cot, uf)
    const adicEsc = 100 / 0.85
    expect(r2.valor_escritura_uf).toBeCloseTo(tas + adicEsc, 2)
  })

  it('ejemplo manual: 10% lista, neto 3589,2; beneficio inmob. y b_max 15%; est 200 bod 100 con beneficio en adicionales', () => {
    const cot = cotEjemploPlanilla()
    cot.propiedad.precio_lista_uf = 3988
    cot.propiedad.descuento_uf = 398.8
    cot.propiedad.precio_neto_uf = 3589.2
    cot.propiedad.bono_descuento_pct = 0.15
    cot.propiedad.bono_max_pct = 0.15
    cot.propiedad.estacionamiento_uf = 200
    cot.propiedad.bodega_uf = 100
    cot.propiedad.bono_aplica_adicionales = true
    const r = calcularResultadosCotizacion(cot, uf)
    expect(r.valor_tasacion_uf).toBeCloseTo(3589.2, 2)
    const adicEsc = 200 / 0.85 + 100 / 0.85
    expect(r.valor_escritura_uf).toBeCloseTo(3589.2 + adicEsc, 2)
  })

  it('beneficio inmob. 0% y bono_max 10%: tasación = neto × (1 − b_max)', () => {
    const cot = cotEjemploPlanilla()
    cot.propiedad.bono_descuento_pct = 0
    cot.propiedad.bono_max_pct = 0.1
    const r = calcularResultadosCotizacion(cot, uf)
    expect(r.valor_tasacion_uf).toBeCloseTo(cot.propiedad.precio_neto_uf * 0.9, 2)
    expect(valorTasacionDeptoUf(100, 0, 0.1)).toBeCloseTo(90, 6)
    expect(valorTasacionDeptoUf(3389.8, 0, 0.1)).toBeCloseTo(3050.82, 2)
  })

  it('neto 3389,80; b_max 15%; b_desc 10%: tasación ≈ 3201,48 UF', () => {
    expect(valorTasacionDeptoUf(3389.8, 0.1, 0.15)).toBeCloseTo(3201.48, 2)
  })

  it('con beneficio 100% evita división por cero: tasación = precio neto', () => {
    const cot = cotEjemploPlanilla()
    cot.propiedad.bono_descuento_pct = 1
    const r = calcularResultadosCotizacion(cot, uf)
    expect(r.valor_tasacion_uf).toBe(2881.33)
  })

  it('validación automática §variables_calculo: ejemplo planilla pasa', () => {
    const cot = cotEjemploPlanilla()
    const r = calcularResultadosCotizacion(cot, uf)
    const v = validarResultadosCotizacion(cot, r)
    expect(v.ok, v.fallos.map((f) => `${f.id}: ${f.mensaje}`).join(' | ')).toBe(true)
  })

  it('cadena referencia: lista 3988 → neto 3589,2; bonif 10% compra 3230,28; BI 15% tasación 3800,33', () => {
    const cot = cotEjemploPlanilla()
    cot.propiedad.precio_lista_uf = 3988
    cot.propiedad.descuento_uf = 398.8
    cot.propiedad.precio_neto_uf = 3589.2
    cot.propiedad.bono_max_pct = 0.1
    cot.propiedad.bono_descuento_pct = 0.15
    const r = calcularResultadosCotizacion(cot, uf)
    expect(r.precio_compra_total_uf).toBeCloseTo(3230.28, 2)
    expect(r.valor_tasacion_uf).toBeCloseTo(3800.33, 2)
    expect(r.valor_escritura_uf).toBeCloseTo(3800.33, 2)
  })
})

describe('calcularPlusvalia', () => {
  it('precio venta y utilidad según §3.4', () => {
    const uf = 38_000
    const valorEsc = 1000
    const pie = 200
    const r = calcularPlusvalia(valorEsc, pie, 0.042, 5, uf)
    const precioVentaBruto = valorEsc * Math.pow(1.042, 5)
    expect(r.precio_venta_5anos_uf).toBeCloseTo(precioVentaBruto, 2)
    const gananciaBrutaUf = precioVentaBruto - valorEsc + pie
    expect(r.ganancia_venta_uf).toBeCloseTo(Math.round(gananciaBrutaUf * 100) / 100, 2)
    // utilidad_pct en motor usa ganancia antes del round2 del retorno
    expect(r.utilidad_pct).toBeCloseTo((gananciaBrutaUf - pie) / pie, 6)
  })
})

describe('calcularArriendo', () => {
  it('renta larga: resultado = arriendo − dividendo CLP', () => {
    const rent = { ...DEFAULT_RENTABILIDAD, tipo_renta: 'larga' as const, arriendo_mensual_clp: 500_000 }
    const r = calcularArriendo(rent, 10, 2000, 40_000)
    expect(r.ingreso_neto_flujo_clp).toBe(500_000)
    expect(r.resultado_mensual_clp).toBe(500_000 - Math.round(10 * 40_000))
  })

  it('renta corta: neto = (tarifa×30×ocup) − admin% − gastos; bruto derivado', () => {
    const rent = {
      ...DEFAULT_RENTABILIDAD,
      tipo_renta: 'corta' as const,
      airbnb_valor_dia_clp: 50_000,
      airbnb_ocupacion_pct: 2 / 3,
      airbnb_admin_pct: 0.25,
      gastos_comunes_clp: 50_000,
    }
    const bruto = Math.round(50_000 * 30 * (2 / 3))
    const admin = Math.round(bruto * 0.25)
    const neto = bruto - admin - 50_000
    const r = calcularArriendo(rent, 5, 1000, 40_000)
    expect(r.airbnb_ingreso_bruto_clp).toBe(bruto)
    expect(r.ingreso_neto_flujo_clp).toBe(neto)
    expect(r.airbnb_admin_clp).toBe(admin)
  })
})

describe('calcularHipotecario', () => {
  it('tasa anual 0 reparte capital en cuotas constantes y saldo llega a 0', () => {
    const hip = {
      ...DEFAULT_HIPOTECARIO,
      hipotecario_tasa_anual: 0,
      hipotecario_plazo_anos: 1,
      hipotecario_aprobacion_pct: 1,
      hipotecario_seg_desgravamen_uf: 0,
      hipotecario_seg_sismos_uf: 0,
      hipotecario_tasa_seg_vida_pct: 0,
    }
    const r = calcularHipotecario(120, hip, 1000)
    expect(r.monto_credito_uf).toBe(120)
    expect(r.tabla_amortizacion).toHaveLength(12)
    const ultimo = r.tabla_amortizacion[11]
    expect(ultimo.saldo_uf).toBe(0)
    const sumaCapital = r.tabla_amortizacion.reduce((s, f) => s + f.capital_uf, 0)
    expect(sumaCapital).toBeCloseTo(120, 1)
  })

  it('plazo 0 o monto 0 no rompe y devuelve tabla vacía', () => {
    const hip = {
      ...DEFAULT_HIPOTECARIO,
      hipotecario_plazo_anos: 0,
      hipotecario_aprobacion_pct: 0.8,
    }
    const r = calcularHipotecario(1000, hip, 1000)
    expect(r.tabla_amortizacion).toHaveLength(0)
    expect(r.monto_credito_uf).toBe(800)
  })
})
