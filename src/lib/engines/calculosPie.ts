import type { DatosDesglosePie } from '@/types'

/** Montos mensuales / upfront del pie en pesos (misma lógica que la planilla de cuotas). */
export interface MontosDesglosePieClp {
  monto_upfront_clp: number
  monto_cuota_antes_clp: number
  monto_cuota_despues_clp: number
  monto_cuoton_clp: number
}

/**
 * Desglose en CLP según % upfront, tramos antes/después y cuotón.
 * Los % se aplican sobre el valor de escrituración (UF×CLP), alineado a planilla Excel (variables_calculo.md §9).
 * Cada tramo en UF se reparte en N cuotas (si N = 0 se usa 1 para evitar división por cero).
 */
export function calcularMontosDesglosePieClp(
  valor_escritura_uf: number,
  pie: DatosDesglosePie,
  uf_valor_clp: number
): MontosDesglosePieClp {
  const uf = uf_valor_clp
  const baseUf = valor_escritura_uf
  const monto_upfront_clp = Math.round(baseUf * pie.upfront_pct * uf)
  const tramoAntesUf = baseUf * pie.cuotas_antes_entrega_pct
  const nAntes = Math.max(pie.cuotas_antes_entrega_n, 1)
  const monto_cuota_antes_clp = Math.round((tramoAntesUf / nAntes) * uf)
  const tramoDespuesUf = baseUf * pie.cuotas_despues_entrega_pct
  const nDespues = Math.max(pie.cuotas_despues_entrega_n, 1)
  const monto_cuota_despues_clp = Math.round((tramoDespuesUf / nDespues) * uf)
  const tramoCuotonUf = baseUf * pie.cuoton_pct
  const nCuoton = Math.max(pie.cuoton_n_cuotas || 1, 1)
  const monto_cuoton_clp = Math.round((tramoCuotonUf / nCuoton) * uf)
  return {
    monto_upfront_clp,
    monto_cuota_antes_clp,
    monto_cuota_despues_clp,
    monto_cuoton_clp,
  }
}
