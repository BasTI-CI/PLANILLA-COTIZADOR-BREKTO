/**
 * Normalización de `estado` en tablas de catálogo (proyectos / inmobiliarias).
 * Ajustá la lista si en tu BD usás otros valores.
 */
export function esEstadoActivoCatalogo(estado: unknown): boolean {
  const t = String(estado ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!t) return false
  if (t.includes('inactiv')) return false
  return t === 'activo' || t === 'activa' || t === 'active'
}

/** Si la fila no tiene columna `estado` o viene vacía, no filtra por ella (solo vínculo con proyectos activos). */
export function inmobiliariaPasaFiltroEstado(row: Record<string, unknown>): boolean {
  if (!Object.prototype.hasOwnProperty.call(row, 'estado')) return true
  const v = row.estado
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  return esEstadoActivoCatalogo(v)
}
