import type { DatosPropiedad } from '@/types'

/**
 * Precio de compra total (UF): suma de precios netos comerciales por rubro
 * (depto + estacionamiento + bodega), todos **después** de descuentos sobre lista,
 * **antes** del beneficio inmobiliario hacia tasación.
 *
 * @see variables_calculo.md §1.0.0
 */
export function precioCompraTotalUf(
  p: Pick<DatosPropiedad, 'precio_neto_uf' | 'estacionamiento_uf' | 'bodega_uf'>
): number {
  return p.precio_neto_uf + p.estacionamiento_uf + p.bodega_uf
}
