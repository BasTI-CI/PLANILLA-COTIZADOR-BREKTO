/**
 * Nombres de tablas y FK en Supabase (producción).
 * Ajusta estos strings a los nombres reales del esquema `public` (o el schema que uses).
 */
export const TABLAS_DEFINITIVO = {
  /** Tabla de proyectos (selector «Proyecto»). */
  proyectos: 'proyectos',
  /** Tabla de unidades/stock por proyecto. */
  unidades: 'unidades',
} as const

/**
 * Columna FK en la tabla de unidades que apunta al proyecto.
 * Cambia si en tu BD es `id_proyecto`, `proyecto_uuid`, etc.
 */
export const FK_UNIDAD_PROYECTO = 'proyecto_id' as const
