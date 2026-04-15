/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** `imagina` | `definitivo` — ver `src/lib/stock/createStockRepository.ts` */
  readonly VITE_STOCK_BACKEND?: string
  /** Duración máxima de la sesión local del cotizador (ms). Por defecto 8h. */
  readonly VITE_COTIZADOR_SESSION_MAX_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
