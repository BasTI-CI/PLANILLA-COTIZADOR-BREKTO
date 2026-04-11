import type {
  DatosDiversificacion,
  Cotizacion,
  FilaDiversificacion,
} from '@/types'
import { calcularResultadosCotizacion } from './calculosCotizacion'
import { calcularMontosDesglosePieClp } from './calculosPie'
import { devolucionIvaPrecioDeptoClp } from './precioCompra'

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
  const mp = calcularMontosDesglosePieClp(r.valor_escritura_uf, c.pie, uf_valor_clp)
  const pie = c.pie
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

/** Suma (dividendo − arriendo) solo para unidades con mes > mes_entrega_flujo (desde entrega+1). */
function sumaDividendoMenosArriendoPostEntrega(
  cotizacionesActivas: Cotizacion[],
  mes: number,
  uf_valor_clp: number
): number {
  return cotizacionesActivas.reduce((sum, c) => {
    if (c.mes_entrega_flujo == null || mes <= c.mes_entrega_flujo) return sum
    const r = calcularResultadosCotizacion(c, uf_valor_clp)
    return sum + (r.hipotecario.dividendo_total_clp - r.arriendo.ingreso_neto_flujo_clp)
  }, 0)
}

function ivaInyectadoEnMes(
  mes: number,
  datos: DatosDiversificacion,
  activas: Cotizacion[],
  uf_valor_clp: number
): number {
  const manual = datos.diversif_iva_manual_override
  const manualTotal = datos.diversif_iva_total_clp

  const totalShares = activas.reduce((s, c) => s + ivaUnidadClp(c, uf_valor_clp), 0)

  if (!manual) {
    return activas.reduce((s, c) => {
      if (!c.califica_iva || c.mes_entrega_flujo == null) return s
      const mIva = c.mes_entrega_flujo + 5
      if (mes !== mIva || mIva > 60) return s
      return s + ivaUnidadClp(c, uf_valor_clp)
    }, 0)
  }

  const califican = activas.filter((c) => c.califica_iva)
  if (califican.length === 0) return 0

  if (totalShares <= 0) {
    const mesesIva = califican
      .filter((c) => c.mes_entrega_flujo != null)
      .map((c) => (c.mes_entrega_flujo as number) + 5)
      .filter((m) => m >= 1 && m <= 60)
      .sort((a, b) => a - b)
    const primero = mesesIva[0]
    if (mes === primero) return Math.round(manualTotal)
    return 0
  }

  return califican.reduce((s, c) => {
    if (c.mes_entrega_flujo == null) return s
    const mIva = c.mes_entrega_flujo + 5
    if (mes !== mIva || mIva > 60) return s
    const share = ivaUnidadClp(c, uf_valor_clp) / totalShares
    return s + Math.round(manualTotal * share)
  }, 0)
}

// ─────────────────────────────────────────────────────────────────
// MOTOR DE DIVERSIFICACIÓN DE AHORROS — 60 meses (consolidación)
//
// - Pie: upfront mes 1; cuotas antes en 1…nAntes; cuotas después en (nAntes+1)…(nAntes+nDespues);
//   cuotón en 1…nCuoton (según cotizador).
// - Dividendo − arriendo: desde mes_entrega_flujo + 1 por cada cotización.
// - IVA: mes_entrega_flujo + 5 por unidad que califica (manual repartido o lump en primer mes si sin base).
//
// Rentabilidad = Capital_inicio × tasa_mensual
// Capital_fin = Capital_inicio + Ahorro - Egreso + IVA + Rentabilidad
// Egreso mensual = suma pie + max(suma(D−A) post-entrega, 0)
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

  let capital_anterior = diversif_capital_inicial_clp - gasto_escritura_total

  for (let mes = 1; mes <= 60; mes++) {
    const egreso_pie = sumaEgresoPieMes(cotizacionesActivas, mes, uf_valor_clp)
    const da = sumaDividendoMenosArriendoPostEntrega(cotizacionesActivas, mes, uf_valor_clp)
    const egreso_da = Math.max(da, 0)
    const egreso = egreso_pie + egreso_da

    const iva_este_mes = ivaInyectadoEnMes(mes, datos, cotizacionesActivas, uf_valor_clp)
    const ahorro = diversif_ahorro_mensual_clp

    const capital_inicio = capital_anterior + ahorro - egreso + iva_este_mes
    const rentabilizacion = Math.round(capital_inicio * diversif_tasa_mensual)
    const capital_fin = capital_inicio + rentabilizacion

    tabla.push({
      mes,
      capital_inicio: Math.round(capital_inicio),
      ahorro_mensual: ahorro,
      rentabilizacion,
      egreso_cuotas: Math.round(egreso),
      iva_inyeccion: Math.round(iva_este_mes),
      capital_fin: Math.round(capital_fin),
      ganancia_acumulada: Math.round(capital_fin - diversif_capital_inicial_clp),
    })

    capital_anterior = capital_fin
  }

  return tabla
}
