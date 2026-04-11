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

export function bonoPieUf(valorEscrituraUf: number, pie: DatosDesglosePie): number {
  const p = Math.max(0, pctRestoBonificacionPie(pie))
  return valorEscrituraUf * p
}

export function pieAPagarUf(pieTotalUf: number, valorEscrituraUf: number, pie: DatosDesglosePie): number {
  return pieTotalUf - bonoPieUf(valorEscrituraUf, pie)
}
