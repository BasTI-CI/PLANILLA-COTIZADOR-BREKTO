import { lazy, Suspense, useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useUF } from '@/hooks/useSupabase'
import ModuloCotizacion from '@/components/cotizacion/ModuloCotizacion'

/** Carga diferida: mismos componentes y mismos resultados; solo se parte el bundle inicial. */
const ModuloHipotecario = lazy(() => import('@/components/hipotecario/ModuloHipotecario'))
const ModuloResumen = lazy(() => import('@/components/resumen/ModuloResumen'))
const ModuloFlujo = lazy(() => import('@/components/flujo/ModuloFlujo'))
const ModuloPDF = lazy(() => import('@/components/pdf/ModuloPDF'))

const MODULO_FALLBACK = (
  <div
    style={{
      padding: '48px 24px',
      textAlign: 'center',
      color: 'var(--color-text-muted)',
      fontSize: 14,
    }}
  >
    Cargando módulo…
  </div>
)

type ModuloActivo = 'cotizacion' | 'hipotecario' | 'resumen' | 'flujo' | 'pdf'

const MODULOS = [
  { id: 'cotizacion',  label: 'Cotización',           icon: '🏠' },
  { id: 'hipotecario', label: 'Simulador Hipotecario', icon: '🏦' },
  { id: 'flujo',       label: 'Flujo de Caja (60m)',   icon: '📈' },
  { id: 'resumen',     label: 'Resumen Inversión',     icon: '📊' },
  { id: 'pdf',         label: 'Exportar PDF',          icon: '📄' },
] as const

export default function App() {
  const [moduloActivo, setModuloActivo] = useState<ModuloActivo>('cotizacion')
  const { uf, fecha, loading: ufLoading, esFallback } = useUF()
  const { setUfValor, global } = useAppStore()
  const [ufInput, setUfInput] = useState<string>('')
  const [editingUF, setEditingUF] = useState(false)

  useEffect(() => {
    if (uf && !ufLoading) {
      setUfValor(uf)
      setUfInput(uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
  }, [uf, ufLoading])

  const handleUFChange = (val: string) => {
    setUfInput(val)
    const num = parseFloat(val.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num) && num > 0) setUfValor(num)
  }

  return (
    <div className="app-layout">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-logo">
          <div className="logo-icon">B</div>
          <div className="logo-text">
            <span>Brekto</span> Cotizador
          </div>
        </div>

        {/* UF del día */}
        <div className="header-center">
          <span className="uf-badge">UF HOY</span>
          {editingUF ? (
            <input
              className="uf-input"
              value={ufInput}
              onChange={(e) => handleUFChange(e.target.value)}
              onBlur={() => setEditingUF(false)}
              autoFocus
            />
          ) : (
            <span
              className="uf-value"
              onClick={() => setEditingUF(true)}
              title="Clic para editar manualmente"
              style={{ cursor: 'pointer' }}
            >
              {ufLoading ? '...' : `$${global.uf_valor_clp.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          )}
          {ufLoading && <div className="loading-spinner" style={{ width: 14, height: 14 }} />}
          {!ufLoading && (
            <span style={{ fontSize: 10, color: esFallback ? '#f59e0b' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {esFallback ? (
                <><span title="Usando valor de referencia — no se pudo contactar mindicador.cl">⚠️ referencia</span></>
              ) : (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  {fecha && `al ${fecha}`} · mindicador.cl
                </>
              )}
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main-content fade-in">
        {/* Tabs de módulos */}
        <div className="module-tabs">
          {MODULOS.map((m) => (
            <button
              key={m.id}
              className={`module-tab ${moduloActivo === m.id ? 'active' : ''}`}
              onClick={() => setModuloActivo(m.id as ModuloActivo)}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* Contenido de módulos (Suspense solo afecta chunks diferidos; la cotización sigue en el bundle principal) */}
        <Suspense fallback={MODULO_FALLBACK}>
          {moduloActivo === 'cotizacion' && <ModuloCotizacion />}
          {moduloActivo === 'hipotecario' && <ModuloHipotecario />}
          {moduloActivo === 'resumen' && <ModuloResumen />}
          {moduloActivo === 'flujo' && <ModuloFlujo />}
          {moduloActivo === 'pdf' && <ModuloPDF />}
        </Suspense>
      </main>
    </div>
  )
}
