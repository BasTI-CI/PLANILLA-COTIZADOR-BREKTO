/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** `imagina` | `definitivo` — ver `src/lib/stock/createStockRepository.ts` */
  readonly VITE_STOCK_BACKEND?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
