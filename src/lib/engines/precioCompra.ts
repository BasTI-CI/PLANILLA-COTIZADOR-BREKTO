import type { DatosPropiedad } from '@/types'

/**
 * Precio de compra del **depto** (UF): neto tras descuento sobre lista **y** tras el % «Descuento por Bonificación»
 * del motor (`precio_neto_uf × (1 − bono_max_pct)`).
 * Si ese % ya está absorbido en `precio_neto_uf`, `bono_max_pct` debe ser 0.
 *
 * `precio_neto_uf` en datos = precio después de lista/dcto. (p. ej. 3589,2 UF); con b_max 10 % → compra 3230,28 UF.
 *
 * @see variables_calculo.md §1.0.0, §3.1
 */
export function precioCompraDeptoUf(
  p: Pick<DatosPropiedad, 'precio_neto_uf' | 'bono_max_pct'>
): number {
  return p.precio_neto_uf * (1 - p.bono_max_pct)
}

/**
 * Precio de compra total (UF): depto a precio de compra + estacionamiento + bodega (post-descuentos comerciales, pre-BI).
 */
export function precioCompraTotalUf(
  p: Pick<DatosPropiedad, 'precio_neto_uf' | 'bono_max_pct' | 'estacionamiento_uf' | 'bodega_uf'>
): number {
  return precioCompraDeptoUf(p) + p.estacionamiento_uf + p.bodega_uf
}
