import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isCotizadorSessionValid } from '@/lib/auth/cotizadorSession'

type Props = { children: ReactNode }

/**
 * Bloquea el cotizador si no hay sesión local validada (sin JWT en cliente).
 */
export function RequireSession({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!isCotizadorSessionValid()) {
        navigate('/access', { replace: true })
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [navigate])

  if (!isCotizadorSessionValid()) {
    return <Navigate to="/access" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
