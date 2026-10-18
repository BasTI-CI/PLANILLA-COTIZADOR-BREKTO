import type {
  DatosDiversificacion,
  Cotizacion,
  FilaDiversificacion,
  ResultadosCotizacion,
} from '@/types'
import { calcularResultadosCotizacion } from './calculosCotizacion'
import { calcularMontosDesglosePieClp } from './calculosPie'
import { devolucionIvaPrecioDeptoClp } from './precioCompra'
import { cotizacionEfectiva } from './compraContado'

// ─────────────────────────────────────────────────────────────────
// CALCULO DE IVA AUTOMÁTICO
// 15% × precio de compra del **solo departamento** (CLP) si califica — sin est/bod; no sobre escrituración (bono pie).
// Inyección por unidad en mes_entrega_flujo + 5 (consolidación de cajas por departamento).
// ─────────────────────────────────────────────────────────────────
export function calcularIvaTotal(
  cotizaciones: Cotizacion[],
  uf_valor_clp: number
): number {
  return cotizaciones
    .filter((c) => c.activa && c.califica_iva)
    .reduce(
      (sum, c) => sum + devolucionIvaPrecioDeptoClp(c.propiedad, uf_valor_clp),
      0
    )
}

function ivaUnidadClp(c: Cotizacion, uf_valor_clp: number): number {
  if (!c.activa || !c.califica_iva) return 0
  return devolucionIvaPrecioDeptoClp(c.propiedad, uf_valor_clp)
}

/**
 * Egresos de pie (upfront, cuotas antes, cuotas después, cuotón) en el mes m,
 * según desglose del cotizador. Cuotas antes en meses 1…nAntes; cuotas después
 * en meses (nAntes+1)…(nAntes+nDespues).
 */
function egresoPieUnidadMes(
  c: Cotizacion,
  mes: number,
  uf_valor_clp: number
): number {
  if (!c.activa) return 0
  const r = calcularResultadosCotizacion(c, uf_valor_clp)
  // B-04: en compra contado todo el pie va al upfront del mes 1, sin cuotas ni cuotón.
  const pie = cotizacionEfectiva(c).pie
  const mp = calcularMontosDesglosePieClp(r.valor_escritura_uf, pie, uf_valor_clp)
  let out = 0
  if (mes === 1) out += mp.monto_upfront_clp

  const nA = pie.cuotas_antes_entrega_n
  if (nA > 0 && mes >= 1 && mes <= nA) {
    out += mp.monto_cuota_antes_clp
  }

  const nD = pie.cuotas_despues_entrega_n
  const startDespues = nA > 0 ? nA + 1 : 1
  if (nD > 0 && mes >= startDespues && mes <= startDespues + nD - 1) {
    out += mp.monto_cuota_despues_clp
  }

  const nCu = Math.max(pie.cuoton_n_cuotas || 0, 0)
  if (nCu > 0 && mes >= 1 && mes <= nCu) {
    out += mp.monto_cuoton_clp
  }
  return out
}

function sumaEgresoPieMes(
  cotizacionesActivas: Cotizacion[],
  mes: number,
  uf_valor_clp: number
): number {
  return cotizacionesActivas.reduce(
    (s, c) => s + egresoPieUnidadMes(c, mes, uf_valor_clp),
    0
  )
}

/**
 * Ingreso de arriendo de la unidad en el mes j post-entrega (j = mes − mes_entrega_flujo), §3.5.1.
 * j en 1…ag_meses → arriendo garantizado; j > ag_meses → arriendo de mercado (o neto renta corta).
 * La regla de cuándo hay AG (solo renta larga, booleano encendido, ag_meses > 0) ya viene en
 * r.arriendo.tiene_ag (calcularArriendo). Lo que pase del mes 60 simplemente no se consulta.
 */
export function arriendoFlujoUnidadMes(r: ResultadosCotizacion, j: number): number {
  if (j < 1) return 0
  if (r.arriendo.tiene_ag && j <= r.arriendo.ag_meses) return r.arriendo.arriendo_garantizado_clp
  return r.arriendo.ingreso_neto_flujo_clp
}

/**
 * Suma (dividendo − arriendo) solo para unidades con mes > mes_entrega_flujo (desde entrega+1).
 * El arriendo es el AG en los primeros ag_meses post-entrega y el de mercado después (B-07).
 */
function sumaDividendoMenosArriendoPostEntrega(
  cotizacionesActivas: Cotizacion[],
  mes: number,
  uf_valor_clp: number
): number {
  return cotizacionesActivas.reduce((sum, c) => {
    if (c.mes_entrega_flujo == null || mes <= c.mes_entrega_flujo) return sum
    const r = calcularResultadosCotizacion(c, uf_valor_clp)
    const arriendo = arriendoFlujoUnidadMes(r, mes - c.mes_entrega_flujo)
    return sum + (r.hipotecario.dividendo_total_clp - arriendo)
  }, 0)
}

/**
 * Devolución de IVA que le toca a una cotización (CLP), la misma que el flujo 60m
 * inyecta en su mes IVA (mes_entrega_flujo + 5). `null` si no está activa o no califica.
 * - Automático: 15% × precio compra depto (ivaUnidadClp).
 * - Manual: el total manual prorrateado según el IVA automático de cada activa que califica.
 *   Si esa base es 0, el total completo va a la unidad del primer mes IVA en 1..60
 *   (en empate, la primera en el orden de `cotizaciones`); 0 para el resto.
 * Se devuelve aunque la unidad no tenga mes de entrega o su mes IVA pase de 60.
 */
export function devolucionIvaCotizacionClp(
  c: Cotizacion,
  cotizaciones: Cotizacion[],
  datos: DatosDiversificacion,
  uf_valor_clp: number
): number | null {
  if (!c.activa || !c.califica_iva) return null
  if (!datos.diversif_iva_manual_override) return ivaUnidadClp(c, uf_valor_clp)

  const manualTotal = datos.diversif_iva_total_clp
  const activas = cotizaciones.filter((x) => x.activa)
  const totalShares = activas.reduce((s, x) => s + ivaUnidadClp(x, uf_valor_clp), 0)

  if (totalShares <= 0) {
    let duena: Cotizacion | null = null
    let primerMes = Infinity
    for (const x of activas) {
      if (!x.califica_iva || x.mes_entrega_flujo == null) continue
      const m = x.mes_entrega_flujo + 5
      if (m >= 1 && m <= 60 && m < primerMes) {
        primerMes = m
        duena = x
      }
    }
    return duena?.id === c.id ? Math.round(manualTotal) : 0
  }

  const share = ivaUnidadClp(c, uf_valor_clp) / totalShares
  return Math.round(manualTotal * share)
}

function ivaInyectadoEnMes(
  mes: number,
  datos: DatosDiversificacion,
  activas: Cotizacion[],
  uf_valor_clp: number
): number {
  return activas.reduce((s, c) => {
    if (!c.califica_iva || c.mes_entrega_flujo == null) return s
    const mIva = c.mes_entrega_flujo + 5
    if (mes !== mIva || mIva > 60) return s
    return s + (devolucionIvaCotizacionClp(c, activas, datos, uf_valor_clp) ?? 0)
  }, 0)
}

// ─────────────────────────────────────────────────────────────────
// MOTOR DE DIVERSIFICACIÓN DE AHORROS — 60 meses (consolidación)
//
// Movimientos del mes:
// - Pie: upfront mes 1; cuotas antes en 1…nAntes; cuotas después en (nAntes+1)…(nAntes+nDespues);
//   cuotón en 1…nCuoton (según cotizador). Siempre ≥ 0 (egreso).
// - Dividendo − arriendo: desde mes_entrega_flujo + 1 por cada cotización. Arriendo = AG en los
//   primeros ag_meses post-entrega (solo renta larga) y de mercado después (§3.5.1).
//   Con signo: positivo = dividendo domina (egreso); negativo = arriendo domina (ingreso a caja).
// - IVA: mes_entrega_flujo + 5 por unidad que califica (manual repartido o lump en primer mes si sin base).
//
// Convención de capitalización (modelo "deposito al inicio, interés desde el mes siguiente"):
//   rentabilización_m   = capital_inicio_m × tasa_mensual       // sólo el saldo previo rentabiliza
//   capital_inicio_m    = capital_fin_{m-1}                     // saldo con el que arranca el mes
//   capital_fin_m       = capital_inicio_m + ahorro − (pie + (div−arr)) + iva + rentabilización_m
//
// Los depósitos (ahorro/IVA) y egresos del mes no entran a la base de rentabilidad
// de ese mismo mes; recién rentabilizan desde el mes siguiente.
// ─────────────────────────────────────────────────────────────────
export function calcularDiversificacion(
  datos: DatosDiversificacion,
  cotizaciones: Cotizacion[],
  uf_valor_clp: number
): FilaDiversificacion[] {
  const {
    diversif_tasa_mensual,
    diversif_capital_inicial_clp,
    diversif_ahorro_mensual_clp,
    diversif_gastos_operacionales_clp,
    diversif_amoblado_otros_clp,
  } = datos

  const cotizacionesActivas = cotizaciones.filter((c) => c.activa)

  const gasto_escritura_total =
    diversif_gastos_operacionales_clp + diversif_amoblado_otros_clp

  const tabla: FilaDiversificacion[] = []

  // Arranque: capital inicial menos gastos de escrituración (upfront, fuera del bucle).
  let capital_anterior = diversif_capital_inicial_clp - gasto_escritura_total

  for (let mes = 1; mes <= 60; mes++) {
    const egreso_pie = sumaEgresoPieMes(cotizacionesActivas, mes, uf_valor_clp)

    // Dividendo − arriendo con SIGNO (sin clamp). Permite que el excedente de
    // arriendo (arriendo > dividendo) entre como ingreso a caja.
    const dividendo_menos_arriendo = sumaDividendoMenosArriendoPostEntrega(
      cotizacionesActivas,
      mes,
      uf_valor_clp
    )

    const iva_este_mes = ivaInyectadoEnMes(mes, datos, cotizacionesActivas, uf_valor_clp)
    const ahorro = diversif_ahorro_mensual_clp

    // Modelo B: la rentabilidad del mes m se calcula sobre el saldo con el que
    // arrancó el mes (capital_inicio = capital_fin del mes anterior). Los
    // movimientos de este mes (ahorro, pie, div−arr, iva) rentabilizan recién
    // desde el mes siguiente.
    const capital_inicio = capital_anterior
    const rentabilizacion = Math.round(capital_inicio * diversif_tasa_mensual)

    // Cierre del mes: saldo previo + movimientos netos + rentabilidad del mes.
    const capital_fin =
      capital_inicio +
      ahorro -
      egreso_pie -
      dividendo_menos_arriendo +
      iva_este_mes +
      rentabilizacion

    tabla.push({
      mes,
      capital_inicio: Math.round(capital_inicio),
      ahorro_mensual: ahorro,
      rentabilizacion,
      egreso_pie_clp: Math.round(egreso_pie),
      dividendo_menos_arriendo_clp: Math.round(dividendo_menos_arriendo),
      iva_inyeccion: Math.round(iva_este_mes),
      capital_fin: Math.round(capital_fin),
      ganancia_acumulada: Math.round(capital_fin - diversif_capital_inicial_clp),
    })

    capital_anterior = capital_fin
  }

  return tabla
}
