import type {
  Cotizacion,
  DatosRentabilidad,
  ResultadosCotizacion,
  FilaAmortizacion,
  ResultadosHipotecario,
  ResultadosPlusvaliaVenta,
  ResultadosArriendo,
} from '@/types'
import { precioCompraTotalUf } from './precioCompra'

// ─────────────────────────────────────────────────────────────────
// MOTOR DE CÁLCULO — fórmulas exactas de la planilla Excel
// ─────────────────────────────────────────────────────────────────

/**
 * Tasación depto (UF), una sola fórmula (variables_calculo.md §3.1):
 * `precio_neto × (1 − bono_max_pct) ÷ (1 − bono_descuento_pct)`
 * UI: beneficio inmobiliario vs Descuento por Bonificación — en código `b_desc` / `b_max`.
 * - Solo bonificación comercial vía `bono_max_pct` (beneficio inmob. 0 %): tasación = neto × (1 − b_max).
 * - Solo beneficio inmobiliario (`bono_max_pct` 0 %): tasación = neto ÷ (1 − b_desc).
 * - Ambos activos: producto del numerador y divisor anteriores.
 * Si `(1 − b_desc) ≤ 0`, se devuelve `precio_neto` (evita división inválida).
 */
export function valorTasacionDeptoUf(
  precio_neto_uf: number,
  bono_descuento_pct: number,
  bono_max_pct: number
): number {
  const db = 1 - bono_descuento_pct
  const numer = precio_neto_uf * (1 - bono_max_pct)
  if (db <= 0) return precio_neto_uf
  return numer / db
}

function adicionalesEscrituraUf(propiedad: Cotizacion['propiedad']): number {
  const est = propiedad.estacionamiento_uf
  const bod = propiedad.bodega_uf
  if (!propiedad.bono_aplica_adicionales) return est + bod
  const d = 1 - propiedad.bono_descuento_pct
  if (d <= 0) return est + bod
  return est / d + bod / d
}

/**
 * Punto de entrada principal — calcula todos los resultados de una cotización
 */
export function calcularResultadosCotizacion(
  cot: Cotizacion,
  uf_valor_clp: number
): ResultadosCotizacion {
  const { propiedad, pie, hipotecario, rentabilidad } = cot
  const precio_neto_uf = propiedad.precio_neto_uf
  const bono_descuento_pct = propiedad.bono_descuento_pct
  const bono_max_pct = propiedad.bono_max_pct

  const valor_tasacion_uf = valorTasacionDeptoUf(
    precio_neto_uf,
    bono_descuento_pct,
    bono_max_pct
  )

  const adicionales_en_escritura_uf = adicionalesEscrituraUf(propiedad)

  const valor_escritura_uf = valor_tasacion_uf + adicionales_en_escritura_uf
  const precio_compra_total_uf = precioCompraTotalUf(propiedad)

  // Monto UF = valor_tasacion_uf * bono_descuento_pct (resultado `beneficio_inmobiliario_uf`).
  const beneficio_inmobiliario_uf = valor_tasacion_uf * bono_descuento_pct

  // Pie total sobre valor de escrituración.
  const pie_total_uf = valor_escritura_uf * pie.pie_pct
  const pie_total_clp = pie_total_uf * uf_valor_clp

  // Validación de consistencia pie + LTV = 100%.
  const pctTotal = pie.pie_pct + hipotecario.hipotecario_aprobacion_pct
  if (Math.abs(pctTotal - 1) > 0.0001) {
    console.warn('Revisar porcentajes ya que son diferentes a 100%')
  }

  // Simulador hipotecario sobre valor de escrituración.
  const hipResult = calcularHipotecario(
    valor_escritura_uf,
    hipotecario,
    uf_valor_clp
  )

  // 5. Plusvalía / venta
  const plusvalia = calcularPlusvalia(
    valor_escritura_uf,
    pie_total_uf,
    rentabilidad.plusvalia_anual_pct,
    rentabilidad.plusvalia_anos,
    uf_valor_clp
  )

  // 6. Arriendo convencional + AirBnB
  const arriendo = calcularArriendo(
    rentabilidad,
    hipResult.dividendo_total_uf,
    valor_escritura_uf,
    uf_valor_clp
  )

  return {
    cotizacion_id: cot.id,
    precio_compra_total_uf,
    valor_tasacion_uf,
    valor_escritura_uf,
    beneficio_inmobiliario_uf,
    pie_total_uf,
    pie_total_clp,
    hipotecario: hipResult,
    plusvalia,
    arriendo,
  }
}

// ─────────────────────────────────────────────────────────────────
// SIMULADOR HIPOTECARIO — Sistema Francés con seguros
// Replicado de Simulador 1 col B + G/H/I/J/K/L/M/N/O
// ─────────────────────────────────────────────────────────────────
export function calcularHipotecario(
  valor_escritura_uf: number,
  hip: Cotizacion['hipotecario'],
  uf_valor_clp: number
): ResultadosHipotecario {
  const {
    hipotecario_aprobacion_pct,
    hipotecario_tasa_anual,
    hipotecario_plazo_anos,
    hipotecario_seg_desgravamen_uf,
    hipotecario_seg_sismos_uf,
    hipotecario_tasa_seg_vida_pct,
  } = hip

  const monto_credito_uf = valor_escritura_uf * hipotecario_aprobacion_pct
  const monto_credito_clp = monto_credito_uf * uf_valor_clp

  const n_meses = Math.max(0, Math.round(hipotecario_plazo_anos * 12))
  const tasa_mensual = hipotecario_tasa_anual / 12

  if (n_meses <= 0 || monto_credito_uf <= 0) {
    const segFijos =
      hipotecario_seg_desgravamen_uf + hipotecario_seg_sismos_uf
    const minVida = 0.01
    const dividendo_total_uf = segFijos + minVida
    return {
      monto_credito_uf,
      monto_credito_clp,
      dividendo_capital_uf: 0,
      dividendo_total_uf,
      dividendo_total_clp: Math.round(dividendo_total_uf * uf_valor_clp),
      tabla_amortizacion: [],
    }
  }

  // Cuota fija capital+interés: tasa > 0 → sistema francés; tasa = 0 → capital constante.
  let cuota_capital_uf: number
  if (tasa_mensual > 0) {
    cuota_capital_uf =
      monto_credito_uf *
      (tasa_mensual / (1 - Math.pow(1 + tasa_mensual, -n_meses)))
  } else {
    cuota_capital_uf = monto_credito_uf / n_meses
  }

  const tabla: FilaAmortizacion[] = []
  let saldo = monto_credito_uf

  for (let mes = 1; mes <= n_meses; mes++) {
    const interes_uf = Math.round(saldo * tasa_mensual * 100) / 100
    const es_ultimo = mes === n_meses
    const capital_uf = es_ultimo
      ? saldo
      : Math.round((cuota_capital_uf - interes_uf) * 100) / 100

    const seg_vida_uf = Math.max(
      Math.round(saldo * hipotecario_tasa_seg_vida_pct * 100) / 100 * uf_valor_clp,
      0.01 * uf_valor_clp
    ) / uf_valor_clp

    const cuota_total_uf =
      capital_uf + interes_uf +
      hipotecario_seg_desgravamen_uf +
      seg_vida_uf +
      hipotecario_seg_sismos_uf

    saldo = Math.round((saldo - capital_uf) * 100) / 100

    tabla.push({
      mes,
      capital_uf,
      interes_uf,
      seg_vida_uf,
      seg_desgravamen_uf: hipotecario_seg_desgravamen_uf,
      seg_sismos_uf: hipotecario_seg_sismos_uf,
      cuota_total_uf,
      cuota_total_clp: Math.round(cuota_total_uf * uf_valor_clp),
      saldo_uf: saldo,
    })
  }

  const dividendo_total_uf = tabla[0]?.cuota_total_uf ?? 0

  return {
    monto_credito_uf,
    monto_credito_clp,
    dividendo_capital_uf: (tabla[0]?.capital_uf ?? 0) + (tabla[0]?.interes_uf ?? 0),
    dividendo_total_uf,
    dividendo_total_clp: Math.round(dividendo_total_uf * uf_valor_clp),
    tabla_amortizacion: tabla,
  }
}

// ─────────────────────────────────────────────────────────────────
// PLUSVALÍA — FV() de Excel
// FV(rate, nper, 0, -pv, 1) * -1
// ─────────────────────────────────────────────────────────────────
export function calcularPlusvalia(
  valor_escritura_uf: number,
  pie_total_uf: number,
  plusvalia_anual_pct: number,
  plusvalia_anos: number,
  uf_valor_clp: number
): ResultadosPlusvaliaVenta {
  // FV con pagos al inicio del período (type=1)
  const precio_venta_5anos_uf =
    valor_escritura_uf * Math.pow(1 + plusvalia_anual_pct, plusvalia_anos)

  const ganancia_venta_uf = precio_venta_5anos_uf - valor_escritura_uf + pie_total_uf
  const ganancia_venta_clp = ganancia_venta_uf * uf_valor_clp

  // Utilidad sobre el pie invertido
  const utilidad_pct = pie_total_uf > 0
    ? (ganancia_venta_uf - pie_total_uf) / pie_total_uf
    : Infinity

  return {
    precio_venta_5anos_uf: Math.round(precio_venta_5anos_uf * 100) / 100,
    ganancia_venta_uf: Math.round(ganancia_venta_uf * 100) / 100,
    ganancia_venta_clp: Math.round(ganancia_venta_clp),
    utilidad_pct,
  }
}

// ─────────────────────────────────────────────────────────────────
// ARRIENDO CONVENCIONAL + AIRBNB
// Fórmulas de Depto A (H36, H37, L40-L41 y R97)
// ─────────────────────────────────────────────────────────────────

/** Días de mes para pasar de tarifa/noche a ingreso bruto mensual (renta corta). */
export const DIAS_MES_RENTA_CORTA = 30

/**
 * Ingreso bruto mensual renta corta: tarifa/noche × días × ocupación (0–1).
 * Equivale a (a×b) con b = noches equivalentes al mes.
 */
export function brutoMensualRentaCortaClp(
  r: Pick<DatosRentabilidad, 'airbnb_valor_dia_clp' | 'airbnb_ocupacion_pct'>
): number {
  return Math.round(r.airbnb_valor_dia_clp * DIAS_MES_RENTA_CORTA * r.airbnb_ocupacion_pct)
}

/**
 * Ingreso neto mensual renta corta: (bruto)×(1−admin) − costos fijos
 * con admin aplicado sobre bruto en pesos redondeados.
 */
export function ingresoNetoMensualRentaCortaClp(
  r: Pick<
    DatosRentabilidad,
    'airbnb_valor_dia_clp' | 'airbnb_ocupacion_pct' | 'airbnb_admin_pct' | 'gastos_comunes_clp'
  >
): number {
  const bruto = brutoMensualRentaCortaClp(r)
  const admin_clp = Math.round(bruto * r.airbnb_admin_pct)
  return bruto - admin_clp - r.gastos_comunes_clp
}

export function calcularArriendo(
  rent: Cotizacion['rentabilidad'],
  dividendo_total_uf: number,
  valor_escritura_uf: number,
  uf_valor_clp: number
): ResultadosArriendo {
  const { tipo_renta, arriendo_mensual_clp, airbnb_admin_pct } = rent

  const dividendo_clp = Math.round(dividendo_total_uf * uf_valor_clp)

  // ── Renta Larga: neto ingresado por el usuario
  // ── Renta Corta: bruto = tarifa/noche × 30 × ocupación; neto = bruto − admin% − costos
  const bruto_mensual_corta = brutoMensualRentaCortaClp(rent)
  const ingreso_neto_clp =
    tipo_renta === 'corta' ? ingresoNetoMensualRentaCortaClp(rent) : arriendo_mensual_clp

  const ingreso_uf = ingreso_neto_clp / uf_valor_clp

  const resultado_mensual_clp = ingreso_neto_clp - dividendo_clp

  const cap_rate_anual_pct =
    valor_escritura_uf > 0 ? (ingreso_uf * 12) / valor_escritura_uf : 0

  const airbnb_admin_clp =
    tipo_renta === 'corta' ? Math.round(bruto_mensual_corta * airbnb_admin_pct) : 0
  const airbnb_resultado_clp = tipo_renta === 'corta' ? ingreso_neto_clp : 0
  const airbnb_cap_rate_anual_pct = tipo_renta === 'corta' ? cap_rate_anual_pct : 0

  return {
    resultado_mensual_clp,
    cap_rate_anual_pct: tipo_renta === 'larga' ? cap_rate_anual_pct : 0,
    airbnb_ingreso_bruto_clp: tipo_renta === 'corta' ? bruto_mensual_corta : 0,
    airbnb_admin_clp,
    airbnb_resultado_clp,
    airbnb_cap_rate_anual_pct,
    ingreso_neto_flujo_clp: ingreso_neto_clp,
  }
}

