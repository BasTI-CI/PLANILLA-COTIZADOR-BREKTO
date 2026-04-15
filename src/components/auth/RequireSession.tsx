import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isDevAuthBypassEnabled } from '@/lib/auth/devBypass'
import { isCotizadorSessionValid } from '@/lib/auth/cotizadorSession'

type Props = { children: ReactNode }

/**
 * Bloquea el cotizador si no hay sesión local validada (sin JWT en cliente).
 * En desarrollo, el gate se puede desactivar (ver `isDevAuthBypassEnabled`).
 */
export function RequireSession({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const bypass = isDevAuthBypassEnabled()

  useEffect(() => {
    if (bypass) return
    const id = window.setInterval(() => {
      if (!isCotizadorSessionValid()) {
        navigate('/access', { replace: true })
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [navigate, bypass])

  if (bypass) {
    return <>{children}</>
  }

  if (!isCotizadorSessionValid()) {
    return <Navigate to="/access" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
