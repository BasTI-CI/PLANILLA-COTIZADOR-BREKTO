import type { ProyectoSupabase, UnidadSupabase } from '@/types'

/**
 * Contrato para orígenes de stock dinámicos (Supabase u otro backend).
 * Las reglas de cálculo viven en `src/lib/engines/*`; esta capa solo lista
 * proyectos/unidades y entrega filas ya normalizadas a `UnidadSupabase`.
 */
export interface StockRepository {
  /** Proyectos visibles para el selector (orden estable recomendado). */
  listProyectos(): Promise<ProyectoSupabase[]>

  /** Unidades de stock del proyecto; `proyectoId` vacío puede devolver []. */
  listUnidadesByProyecto(proyectoId: string): Promise<UnidadSupabase[]>
}

export interface StockValidationIssue {
  code: string
  message: string
}

export interface StockValidationResult {
  ok: boolean
  issues: StockValidationIssue[]
}
