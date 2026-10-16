import type { Cotizacion } from '@/types'

/** B-04: `compra_contado` ausente (cotizaciones antiguas, fixtures) equivale a `false`. */
export function esCompraContado(c: Cotizacion): boolean {
  return c.compra_contado === true
}

/**
 * Cotización tal como la calcula y la muestra el cotizador.
 *
 * Compra contado (B-04 · variables_calculo.md «Compra al contado»). BR, 2026-10-16: «el crédito
 * es 0% y el pago es en una sola cuota igual al 100% del precio real de compra del departamento
 * y sus eventuales adicionales. Sin bono.»
 *
 * Con `compra_contado` activo devuelve una copia con BI 0, pie 100 % todo en upfront (sin cuotas
 * ni cuotón, bono pie 0) y crédito 0 %. Los valores que ingresó el asesor quedan intactos en el
 * store, así que al desactivar el modo vuelven tal cual. Sin contado devuelve la misma referencia.
 *
 * Los inputs del formulario leen la cotización cruda; todo lo calculado o mostrado, esta.
 */
export function cotizacionEfectiva(c: Cotizacion): Cotizacion {
  if (!esCompraContado(c)) return c
  return {
    ...c,
    propiedad: { ...c.propiedad, bono_descuento_pct: 0 },
    pie: {
      ...c.pie,
      pie_pct: 1,
      upfront_pct: 1,
      cuotas_antes_entrega_pct: 0,
      cuotas_antes_entrega_n: 0,
      cuotas_despues_entrega_pct: 0,
      cuotas_despues_entrega_n: 0,
      cuoton_pct: 0,
      cuoton_n_cuotas: 0,
      pie_n_cuotas_total: 0,
    },
    hipotecario: { ...c.hipotecario, hipotecario_aprobacion_pct: 0 },
  }
}
