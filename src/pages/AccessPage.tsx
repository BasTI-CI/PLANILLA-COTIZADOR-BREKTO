import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { setCotizadorSession, isCotizadorSessionValid } from '@/lib/auth/cotizadorSession'
import type { ValidateCotizadorAccessResponse } from '@/types/auth'

function parseFunctionInvokeMessage(err: {
  message: string
  context?: unknown
}): string {
  const ctx = err.context as
    | { data?: { error?: string; message?: string } }
    | Response
    | undefined
  if (ctx && typeof (ctx as Response).text === 'function') {
    return err.message
  }
  if (ctx && typeof ctx === 'object' && 'data' in ctx) {
    const d = (ctx as { data?: { error?: string; message?: string } }).data
    if (d) {
      const t = d.error || d.message
      if (typeof t === 'string' && t.trim()) return t
    }
  }
  return err.message
}

/**
 * /access?token=JWT
 * 1) Invoca `validate-cotizador-access` (Edge Function) con { token }.
 * 2) Si es válido: `setCotizadorSession` → `localStorage` clave `cotizador_user` = `data.user` (JSON);
 *    el JWT no se persiste nunca.
 * 3) Limpia el query (replaceState) y entra a `/` sin el token en la barra.
 */
export default function AccessPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = new URLSearchParams(location.search).get('token')

  const [phase, setPhase] = useState<'loading' | 'error' | 'ok'>(() =>
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
            'Falta configurar Supabase. En Vite: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY (equivalente a SUPABASE_URL / ANON en el panel).'
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
        setErrorMessage(parseFunctionInvokeMessage(error as { message: string; context?: unknown }))
        return
      }

      const payload = data as ValidateCotizadorAccessResponse | null
      if (payload == null) {
        setPhase('error')
        setErrorMessage('Respuesta vacía del servicio de acceso.')
        return
      }

      if (payload.valid !== true || payload.user == null) {
        setPhase('error')
        setErrorMessage(
          typeof payload.error === 'string' && payload.error
            ? payload.error
            : 'Acceso no autorizado o token inválido.'
        )
        return
      }

      // Solo datos validados; nunca se guarda el JWT
      setCotizadorSession(payload.user, {
        maxAgeMs: payload.sessionMaxAgeMs,
      })

      window.history.replaceState({}, document.title, '/')
      if (!cancelled) setPhase('ok')
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

  if (phase === 'loading' || phase === 'ok') {
    return (
      <div className="auth-gate-screen">
        <div className="auth-gate-card">
          <p className="auth-gate-title">Validando acceso…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-gate-screen">
      <div className="auth-gate-card">
        <p className="auth-gate-title auth-gate-error">No se pudo acceder</p>
        <p className="auth-gate-message">{errorMessage}</p>
        <p className="auth-gate-hint" style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/unauthorized">Más información</Link>
        </p>
      </div>
    </div>
  )
}
