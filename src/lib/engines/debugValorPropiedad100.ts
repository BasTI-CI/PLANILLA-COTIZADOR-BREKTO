import type { Cotizacion, ResultadosCotizacion } from '@/types'

const EPS_UF = 0.02
const EPS_PCT = 0.0005

export interface DebugValorPropiedad100 {
  /** precio_lista - descuento_uf === precio_neto (coherencia de inputs) */
  okListaMenosDescuentoIgualNeto: boolean
  deltaListaNetoUf: number

  /**
   * precio_neto === valor_tasacion * (1 - bono_descuento_pct)
   * Equivale a la identidad inversa de variables_calculo: tasacion = neto / (1 - b_desc)
   */
  okNetoCoherenteConBeneficioInmobiliario: boolean
  deltaNetoTasacionUf: number

  /** pie_pct + financiamiento === 100% */
  okPieMasCreditoPct: boolean
  sumaPieYLtv: number
  deltaPct: number

  /** pie_total_uf + monto_credito_uf === valor_escritura_uf (consecuencia del 100%) */
  okPieMasCreditoUfIgualEscritura: boolean
  deltaPieCreditoEscrituraUf: number

  pie_total_uf: number
  monto_credito_uf: number
  valor_escritura_uf: number
  precio_neto_uf: number
  valor_tasacion_uf: number
  beneficio_inmobiliario_uf: number

  allOk: boolean
}

/**
 * Depurador 100% valor propiedad según variables_calculo.md:
 * - Lista − descuentos (precio neto) coherente con tasación y bono_descuento_pct.
 * - PIE a documentar (% sobre escritura) + crédito (%) = 100%.
 * - Montos UF: pie + crédito = valor escrituración.
 */
export function debugValorPropiedad100(
  cot: Cotizacion,
  res: ResultadosCotizacion
): DebugValorPropiedad100 {
  const { propiedad, pie, hipotecario } = cot

  const precioLista = propiedad.precio_lista_uf
  const descuento = propiedad.descuento_uf
  const precioNeto = propiedad.precio_neto_uf
  const listaMenosDesc = precioLista - descuento
  const deltaListaNetoUf = Math.abs(listaMenosDesc - precioNeto)

  const bDesc = propiedad.bono_descuento_pct
  const netoEsperadoDesdeTasacion = res.valor_tasacion_uf * (1 - bDesc)
  const deltaNetoTasacionUf = Math.abs(precioNeto - netoEsperadoDesdeTasacion)

  const sumaPieYLtv = pie.pie_pct + hipotecario.hipotecario_aprobacion_pct
  const deltaPct = Math.abs(sumaPieYLtv - 1)

  const sumaPieCreditoUf = res.pie_total_uf + res.hipotecario.monto_credito_uf
  const deltaPieCreditoEscrituraUf = Math.abs(sumaPieCreditoUf - res.valor_escritura_uf)

  const okListaMenosDescuentoIgualNeto = deltaListaNetoUf <= EPS_UF
  const okNetoCoherenteConBeneficioInmobiliario = deltaNetoTasacionUf <= EPS_UF
  const okPieMasCreditoPct = deltaPct <= EPS_PCT
  const okPieMasCreditoUfIgualEscritura = deltaPieCreditoEscrituraUf <= EPS_UF

  const allOk =
    okListaMenosDescuentoIgualNeto &&
    okNetoCoherenteConBeneficioInmobiliario &&
    okPieMasCreditoPct &&
    okPieMasCreditoUfIgualEscritura

  return {
    okListaMenosDescuentoIgualNeto,
    deltaListaNetoUf,
    okNetoCoherenteConBeneficioInmobiliario,
    deltaNetoTasacionUf,
    okPieMasCreditoPct,
    sumaPieYLtv,
    deltaPct,
    okPieMasCreditoUfIgualEscritura,
    deltaPieCreditoEscrituraUf,
    pie_total_uf: res.pie_total_uf,
    monto_credito_uf: res.hipotecario.monto_credito_uf,
    valor_escritura_uf: res.valor_escritura_uf,
    precio_neto_uf: precioNeto,
    valor_tasacion_uf: res.valor_tasacion_uf,
    beneficio_inmobiliario_uf: res.beneficio_inmobiliario_uf,
    allOk,
  }
}
