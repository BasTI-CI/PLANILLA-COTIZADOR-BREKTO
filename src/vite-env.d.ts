/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Misma clave pública que anon (nombre alternativo en el panel de Supabase). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** `imagina` | `definitivo` | por defecto catálogo `proyectos`/`inmobiliarias` — ver `createStockRepository.ts` */
  readonly VITE_STOCK_BACKEND?: string
  /** Duración máxima de la sesión local del cotizador (ms). Por defecto 8h. */
  readonly VITE_COTIZADOR_SESSION_MAX_MS?: string
  /**
   * Solo en `pnpm dev`: si es `"false"`, exige el flujo SSO como en producción.
   * Cualquier otro valor u omisión → se omite el gate para desarrollar sin Brekto2.
   */
  readonly VITE_DEV_BYPASS_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
