import { useCallback, useEffect, useState } from 'react'
import {
  clearCotizadorSession,
  isCotizadorSessionValid,
  parseStoredUser,
} from '@/lib/auth/cotizadorSession'
import type { CotizadorUser } from '@/types/auth'

/**
 * Estado del usuario del cotizador (solo datos post-validación en servidor; nunca el JWT).
 */
export function useAuth() {
  const [user, setUser] = useState<CotizadorUser | null>(() =>
    isCotizadorSessionValid() ? parseStoredUser() : null
  )

  useEffect(() => {
    if (isCotizadorSessionValid()) {
      setUser(parseStoredUser())
    } else {
      setUser(null)
    }
  }, [])

  const clearSession = useCallback(() => {
    clearCotizadorSession()
    setUser(null)
  }, [])

  const refreshFromStorage = useCallback(() => {
    if (isCotizadorSessionValid()) setUser(parseStoredUser())
    else setUser(null)
  }, [])

  return {
    user,
    isAuthenticated: Boolean(user && isCotizadorSessionValid()),
    clearSession,
    refreshFromStorage,
  }
}
