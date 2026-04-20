import type { StockRepository } from './types'
import { SupabaseDefinitivoRepository } from './definitivo/supabaseDefinitivoRepository'
import { ImaginaPruebaStockRepository } from './imaginaPruebaRepository'
import { ProyectosPublicRepository } from './proyectosPublicRepository'
import { isSupabaseConfigured } from '@/lib/supabase'

type StockBackendMode = 'imagina' | 'definitivo' | 'publico'

function stockBackendMode(): StockBackendMode {
  const raw = (import.meta.env.VITE_STOCK_BACKEND as string | undefined)?.trim().toLowerCase()
  if (raw === 'definitivo') return 'definitivo'
  if (raw === 'imagina') return 'imagina'
  return 'publico'
}

/**
 * - Sin `VITE_SUPABASE_*` o `imagina`: demo `Stock_Imagina_Prueba` / mock embebido.
 * - `definitivo`: tablas en `src/lib/stock/definitivo/schema.ts` (proyectos + unidades).
 * - Por defecto con Supabase configurado: tablas `public.proyectos` / `public.inmobiliarias`.
 */
export function createDefaultStockRepository(): StockRepository {
  const mode = stockBackendMode()
  if (!isSupabaseConfigured() || mode === 'imagina') {
    return new ImaginaPruebaStockRepository()
  }
  if (mode === 'definitivo') {
    return new SupabaseDefinitivoRepository()
  }
  return new ProyectosPublicRepository()
}
