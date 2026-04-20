import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { setCotizadorSession, isCotizadorSessionValid } from '@/lib/auth/cotizadorSession'
import type { ValidateCotizadorAccessResponse } from '@/types/auth'

/**
 * /access?token=JWT — valida contra Edge Function, persiste solo data.user, limpia la URL y entra al cotizador.
 */
export default function AccessPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = new URLSearchParams(location.search).get('token')

  const [phase, setPhase] = useState<'loading' | 'error'>(() =>
    token ? 'loading' : 'error'
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    async function validate() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setPhase('error')
          setErrorMessage(
            'Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY).'
          )
        }
        return
      }

      const supabase = getSupabase()
      if (!supabase) {
        if (!cancelled) {
          setPhase('error')
          setErrorMessage('No se pudo inicializar el cliente Supabase.')
        }
        return
      }

      const { data, error } = await supabase.functions.invoke('validate-cotizador-access', {
        body: { token },
      })

      if (cancelled) return

      if (error) {
        setPhase('error')
        setErrorMessage(error.message || 'No se pudo validar el acceso.')
        return
      }

      const payload = data as ValidateCotizadorAccessResponse | null
      if (!payload || payload.valid !== true || payload.user == null) {
        setPhase('error')
        setErrorMessage(
          typeof payload?.error === 'string' && payload.error
            ? payload.error
            : 'Acceso no autorizado.'
        )
        return
      }

      setCotizadorSession(payload.user, {
        maxAgeMs: payload.sessionMaxAgeMs,
      })

      window.history.replaceState({}, document.title, '/')
      navigate('/', { replace: true })
    }

    void validate()
    return () => {
      cancelled = true
    }
  }, [token, navigate])

  if (!token) {
    if (isCotizadorSessionValid()) {
      return <Navigate to="/" replace />
    }
    return <Navigate to="/unauthorized" replace />
  }

  if (phase === 'loading') {
    return (
      <div className="auth-gate-screen">
        <div className="auth-gate-card">
          <p className="auth-gate-title">Validando acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-gate-screen">
      <div className="auth-gate-card">
        <p className="auth-gate-title auth-gate-error">No se pudo acceder</p>
        <p className="auth-gate-message">{errorMessage}</p>
      </div>
    </div>
  )
}
