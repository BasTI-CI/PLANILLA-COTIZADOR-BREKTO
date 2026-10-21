/** Superficie para mostrar: es-CL, máximo 2 decimales, sin ceros de relleno ('52,4'). No finito → '—'. */
export function formatSuperficie(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 })
}

/** Superficie con unidad: '52,4 m²'. No finito → '—'. */
export function formatM2(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return `${formatSuperficie(v)} m²`
}
