/** Tope de cotizaciones simultáneas (A–J). Única fuente para store, UI y PDF. */
export const MAX_COTIZACIONES = 10

/** Letra visible de una cotización según su índice: 0 → 'A' … 9 → 'J'. */
export function letraCotizacion(idx: number): string {
  return String.fromCharCode(65 + idx)
}
