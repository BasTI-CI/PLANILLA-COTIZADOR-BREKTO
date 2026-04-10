import type { StockRepository } from './types'
import { ImaginaPruebaStockRepository } from './imaginaPruebaRepository'

/**
 * Punto único para elegir el backend de stock. Hoy: tabla de prueba Imagina.
 * Futuro: `VITE_STOCK_PROVIDER` u otra variable, o registro de implementaciones.
 */
export function createDefaultStockRepository(): StockRepository {
  return new ImaginaPruebaStockRepository()
}
