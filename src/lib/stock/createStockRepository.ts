import type { StockRepository } from './types'
import { SupabaseDefinitivoRepository } from './definitivo/supabaseDefinitivoRepository'
import { ImaginaPruebaStockRepository } from './imaginaPruebaRepository'

type StockBackendMode = 'imagina' | 'definitivo'

function stockBackendMode(): StockBackendMode {
  const raw = (import.meta.env.VITE_STOCK_BACKEND as string | undefined)?.trim().toLowerCase()
  if (raw === 'definitivo') return 'definitivo'
  return 'imagina'
}

/**
 * Backend de stock: `imagina` (tabla de prueba + mock sin env) o `definitivo` (tablas productivas).
 * `VITE_STOCK_BACKEND=definitivo` en `.env.local`.
 */
export function createDefaultStockRepository(): StockRepository {
  return stockBackendMode() === 'definitivo'
    ? new SupabaseDefinitivoRepository()
    : new ImaginaPruebaStockRepository()
}
