import type { CotizadorUser } from '@/types/auth'

export const COTIZADOR_USER_KEY = 'cotizador_user'
const COTIZADOR_SESSION_EXPIRES_KEY = 'cotizador_session_expires'

function defaultSessionMaxMs(): number {
  const raw = import.meta.env.VITE_COTIZADOR_SESSION_MAX_MS
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return 8 * 60 * 60 * 1000
}

export function parseStoredUser(): CotizadorUser | null {
  const raw = localStorage.getItem(COTIZADOR_USER_KEY)
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (v !== null && typeof v === 'object') return v as CotizadorUser
    return null
  } catch {
    return null
  }
}

export function clearCotizadorSession(): void {
  localStorage.removeItem(COTIZADOR_USER_KEY)
  localStorage.removeItem(COTIZADOR_SESSION_EXPIRES_KEY)
}

/**
 * Guarda el usuario validado por la Edge Function y opcionalmente la ventana de expiración local.
 */
export function setCotizadorSession(user: CotizadorUser, options?: { maxAgeMs?: number }): void {
  localStorage.setItem(COTIZADOR_USER_KEY, JSON.stringify(user))
  const maxAge = options?.maxAgeMs ?? defaultSessionMaxMs()
  localStorage.setItem(COTIZADOR_SESSION_EXPIRES_KEY, String(Date.now() + maxAge))
}

/**
 * Sesión válida si existe usuario y no venció el tiempo local (opcional).
 */
export function isCotizadorSessionValid(): boolean {
  const raw = localStorage.getItem(COTIZADOR_USER_KEY)
  if (!raw) return false
  let exp = localStorage.getItem(COTIZADOR_SESSION_EXPIRES_KEY)
  if (!exp) {
    localStorage.setItem(COTIZADOR_SESSION_EXPIRES_KEY, String(Date.now() + defaultSessionMaxMs()))
    return true
  }
  const t = parseInt(exp, 10)
  if (Number.isNaN(t) || Date.now() > t) {
    clearCotizadorSession()
    return false
  }
  return true
}
