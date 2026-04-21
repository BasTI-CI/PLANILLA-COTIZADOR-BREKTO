import type { UnidadSupabase } from '@/types'

/**
 * Filtro local opcional por texto de unidad (número/código).
 * Vacío → sin filtro.
 */
export function filterUnidadesPorBusquedaNumero(
  unidades: UnidadSupabase[],
  query: string | null | undefined
): UnidadSupabase[] {
  const q = query?.trim().toLowerCase() ?? ''
  if (!q) return unidades
  return unidades.filter((u) => u.numero.toLowerCase().includes(q))
}
