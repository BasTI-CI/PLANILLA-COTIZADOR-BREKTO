/**
 * Usuario devuelto por la Edge Function `validate-cotizador-access` tras validar el JWT en servidor.
 * El frontend no usa el JWT; solo persiste este objeto en `localStorage` bajo `cotizador_user`.
 */
export type CotizadorUser = Record<string, unknown>

export type ValidateCotizadorAccessResponse = {
  valid?: boolean
  user?: CotizadorUser
  /** Mensaje opcional cuando valid === false */
  error?: string
  /** Duración de sesión en cliente (ms) sugerida por el servidor; si no viene, se usa el default local */
  sessionMaxAgeMs?: number
}
