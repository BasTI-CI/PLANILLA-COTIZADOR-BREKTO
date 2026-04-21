import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { isDevAuthBypassEnabled } from '@/lib/auth/devBypass'
import { isCotizadorSessionValid } from '@/lib/auth/cotizadorSession'

type Props = { children: ReactNode }

/**
 * El cotizador exige haber validado un JWT vía `/access?token=…` (Edge Function)
 * y tener `localStorage` `cotizador_user` (sin el JWT; solo el objeto `user` validado).
 * Sin sesión: redirección dura a `/access` (el JWT nunca se persiste).
 * En `npm run dev`, el gate se puede omitir salvo `VITE_DEV_BYPASS_AUTH=false` en `.env`.
 */
export function RequireSession({ children }: Props) {
  const bypass = isDevAuthBypassEnabled()
  const hasSession = bypass || isCotizadorSessionValid()

  useLayoutEffect(() => {
    if (bypass) return
    if (!isCotizadorSessionValid()) {
      window.location.replace('/access')
    }
  }, [bypass])

  useEffect(() => {
    if (bypass) return
    const id = window.setInterval(() => {
      if (!isCotizadorSessionValid()) {
        window.location.replace('/access')
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [bypass])

  if (bypass) {
    return <>{children}</>
  }

  if (!hasSession) {
    return (
      <div className="auth-gate-screen">
        <div className="auth-gate-card">
          <p className="auth-gate-title">Comprobando sesión…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
