import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="auth-gate-screen">
      <div className="auth-gate-card">
        <p className="auth-gate-title auth-gate-error">Acceso no autorizado</p>
        <p className="auth-gate-message">
          Necesitas un enlace de acceso válido con token. Si crees que es un error, contacta al
          administrador.
        </p>
        <p className="auth-gate-hint">
          <Link to="/access">Ir a validación de acceso</Link>
        </p>
      </div>
    </div>
  )
}
