import type {
  Cotizacion,
  ResultadosCotizacion,
  FilaAmortizacion,
  ResultadosHipotecario,
  ResultadosPlusvaliaVenta,
  ResultadosArriendo,
} from '@/types'

// ─────────────────────────────────────────────────────────────────
// MOTOR DE CÁLCULO — fórmulas exactas de la planilla Excel
// ─────────────────────────────────────────────────────────────────

/**
 * Punto de entrada principal — calcula todos los resultados de una cotización
 */
export function calcularResultadosCotizacion(
  cot: Cotizacion,
  uf_valor_clp: number
): ResultadosCotizacion {
  const { propiedad, pie, hipotecario, rentabilidad } = cot

  // 1. Bono pie (UF)
  const bono_pie_uf = propiedad.precio_compra_uf * pie.pie_pct

  // 2. Monto de escrituración = precio compra + bono pie
  const escrituracion_uf = propiedad.precio_compra_uf + bono_pie_uf

  // 3. Pie total = precio_compra × % pie
  const pie_total_uf = propiedad.precio_compra_uf * pie.pie_pct
  const pie_total_clp = pie_total_uf * uf_valor_clp

  // 4. Simulador hipotecario
  const hipResult = calcularHipotecario(
    propiedad.precio_compra_uf,
    hipotecario,
    uf_valor_clp
  )

  // 5. Plusvalía / venta
  const plusvalia = calcularPlusvalia(
    propiedad.precio_compra_uf,
    pie_total_uf,
    rentabilidad.plusvalia_anual_pct,
    rentabilidad.plusvalia_anos,
    uf_valor_clp
  )

  // 6. Arriendo convencional + AirBnB
  const arriendo = calcularArriendo(
    rentabilidad,
    hipResult.dividendo_total_uf,
    propiedad.precio_compra_uf,
    uf_valor_clp
  )

  return {
    cotizacion_id: cot.id,
    escrituracion_uf,
    bono_pie_uf,
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
  precio_compra_uf: number,
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

  const monto_credito_uf = precio_compra_uf * hipotecario_aprobacion_pct
  const monto_credito_clp = monto_credito_uf * uf_valor_clp

  const n_meses = hipotecario_plazo_anos * 12
  const tasa_mensual = hipotecario_tasa_anual / 12

  // Cuota fija sistema francés (PMT)
  // PMT = PV × r / (1 - (1+r)^-n)
  const cuota_capital_uf =
    monto_credito_uf *
    (tasa_mensual / (1 - Math.pow(1 + tasa_mensual, -n_meses)))

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
  precio_compra_uf: number,
  pie_total_uf: number,
  plusvalia_anual_pct: number,
  plusvalia_anos: number,
  uf_valor_clp: number
): ResultadosPlusvaliaVenta {
  // FV con pagos al inicio del período (type=1)
  const precio_venta_5anos_uf =
    precio_compra_uf * Math.pow(1 + plusvalia_anual_pct, plusvalia_anos)

  const ganancia_venta_uf = precio_venta_5anos_uf - precio_compra_uf + pie_total_uf
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
export function calcularArriendo(
  rent: Cotizacion['rentabilidad'],
  dividendo_total_uf: number,
  precio_compra_uf: number,
  uf_valor_clp: number
): ResultadosArriendo {
  const {
    tipo_renta,
    arriendo_mensual_clp,
    airbnb_ingreso_bruto_clp,
    airbnb_admin_pct,
    gastos_comunes_clp,
  } = rent

  const dividendo_clp = Math.round(dividendo_total_uf * uf_valor_clp)

  // ── Renta Larga ──────────────────────────────────────────────────
  // El arriendo_mensual_clp es el neto ingresado directamente por el usuario
  // ── Renta Corta ──────────────────────────────────────────────────
  // neto = ingreso_bruto - comisión admin - gastos_comunes
  const ingreso_neto_clp = tipo_renta === 'corta'
    ? airbnb_ingreso_bruto_clp - Math.round(airbnb_ingreso_bruto_clp * airbnb_admin_pct) - gastos_comunes_clp
    : arriendo_mensual_clp

  const ingreso_uf = ingreso_neto_clp / uf_valor_clp

  // Resultado mensual = ingreso neto - dividendo
  const resultado_mensual_clp = ingreso_neto_clp - dividendo_clp

  // Cap rate = (ingreso neto anual) / precio compra
  const cap_rate_anual_pct =
    precio_compra_uf > 0 ? (ingreso_uf * 12) / precio_compra_uf : 0

  // Desglose renta corta (para mostrar en UI)
  const airbnb_admin_clp = tipo_renta === 'corta'
    ? Math.round(airbnb_ingreso_bruto_clp * airbnb_admin_pct)
    : 0
  const airbnb_resultado_clp = tipo_renta === 'corta' ? ingreso_neto_clp : 0
  const airbnb_cap_rate_anual_pct = tipo_renta === 'corta' ? cap_rate_anual_pct : 0

  return {
    resultado_mensual_clp,
    cap_rate_anual_pct: tipo_renta === 'larga' ? cap_rate_anual_pct : 0,
    airbnb_ingreso_bruto_clp: airbnb_ingreso_bruto_clp,
    airbnb_admin_clp,
    airbnb_resultado_clp,
    airbnb_cap_rate_anual_pct,
    // El valor que va al flujo siempre es el neto, independiente del tipo
    ingreso_neto_flujo_clp: ingreso_neto_clp,
  }
}

