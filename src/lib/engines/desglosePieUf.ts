import type { DatosDesglosePie } from '@/types'

/**
 * Resto del pie documentado no asignado a abono inicial ni cuotas/cuotón (planilla: bonificación de pie).
 * @see variables_calculo.md §1.0.1 «Bono pie»
 */
function pctRestoBonificacionPie(pie: DatosDesglosePie): number {
  return (
    pie.pie_pct -
    pie.upfront_pct -
    pie.cuotas_antes_entrega_pct -
    pie.cuotas_despues_entrega_pct -
    pie.cuoton_pct
  )
}

/** Umbral bajo el cual el bono pie se considera 0 (absorbe ruido flotante de la resta): 0,005 %. */
export const BONO_PIE_EPS_PCT = 0.00005

/** % de bono pie sobre `valor_escritura_uf`, nunca negativo. */
export function bonoPiePct(pie: DatosDesglosePie): number {
  return Math.max(0, pctRestoBonificacionPie(pie))
}

/** true si la cotización tiene bono pie distinto de 0 (para decidir si se muestra). */
export function tieneBonoPie(pie: DatosDesglosePie): boolean {
  return bonoPiePct(pie) > BONO_PIE_EPS_PCT
}

export function bonoPieUf(valorEscrituraUf: number, pie: DatosDesglosePie): number {
  return valorEscrituraUf * bonoPiePct(pie)
}

export function pieAPagarUf(pieTotalUf: number, valorEscrituraUf: number, pie: DatosDesglosePie): number {
  return pieTotalUf - bonoPieUf(valorEscrituraUf, pie)
}
