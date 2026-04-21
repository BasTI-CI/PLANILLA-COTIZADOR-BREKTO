import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App.tsx'
import { RequireSession } from '@/components/auth/RequireSession'
import AccessPage from '@/pages/AccessPage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'
import './index.css'

/**
 * Rutas públicas: `/access` (SSO con token en query), `/unauthorized`.
 * El cotizador (`/`) exige `localStorage` `cotizador_user` y sesión no vencida; si no, redirección a `/access`.
 * El JWT nunca se guarda; solo el objeto `user` devuelto por la Edge Function.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/access" element={<AccessPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/"
          element={
            <RequireSession>
              <App />
            </RequireSession>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
