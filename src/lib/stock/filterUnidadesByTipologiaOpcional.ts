import type { UnidadSupabase } from '@/types'

/**
 * Filtra unidades por tipología solo cuando aplica:
 * - hay tipología elegida (no vacía), y
 * - existe catálogo de tipologías para el proyecto (items.length > 0).
 *
 * Si no hay catálogo o no hay tipología seleccionada → sin filtro (todo el stock del proyecto).
 */
export function filterUnidadesByTipologiaOpcional(
  unidades: UnidadSupabase[],
  tipologiaSeleccionada: string | null | undefined,
  catalogoTipologias: readonly string[]
): UnidadSupabase[] {
  const t = tipologiaSeleccionada?.trim() ?? ''
  if (!t || catalogoTipologias.length === 0) {
    return unidades
  }
  return unidades.filter((u) => u.tipologia === t)
}
