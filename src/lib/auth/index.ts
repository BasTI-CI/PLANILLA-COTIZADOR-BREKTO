/**
 * Autenticación del cotizador: sesión post-validación en `localStorage` (sin JWT en cliente).
 * Validación: Edge Function `validate-cotizador-access` (ver `/access`).
 */
export { COTIZADOR_USER_KEY, clearCotizadorSession, isCotizadorSessionValid, parseStoredUser, setCotizadorSession } from './cotizadorSession'
export { isDevAuthBypassEnabled } from './devBypass'
export { useAuth } from '@/hooks/useAuth'
