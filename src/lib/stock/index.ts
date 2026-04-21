/** Punto de entrada mínimo: solo lo que consume la app vía `@/lib/stock`. */
export { createDefaultStockRepository, usesEdgeStockQuery } from './createStockRepository'
export { unidadSupabaseToDatosPropiedad } from './mapToDatosPropiedad'
export { validateUnidadSupabaseForMotor } from './validateStockInputs'
export { filterUnidadesByTipologiaOpcional } from './filterUnidadesByTipologiaOpcional'
export { filterUnidadesPorBusquedaNumero } from './filterUnidadesPorBusquedaNumero'
