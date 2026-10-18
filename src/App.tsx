import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useUF } from '@/hooks/useSupabase'
import { debeAvisarUFRespaldo, parsearUF, ufFueraDeRango } from '@/lib/uf'
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
  const [ufEditadaAMano, setUfEditadaAMano] = useState(false)
  /** Espejo de ufEditadaAMano para el efecto de mindicador, sin volver a dispararlo (P-09). */
  const ufEditadaAManoRef = useRef(false)
  /** Edición del header: texto al abrir y si se canceló con Escape (se aplica solo en onBlur). */
  const ufInputAlAbrirRef = useRef('')
  const ufEdicionCanceladaRef = useRef(false)
  /** Borrador del input de la barra de aviso: se aplica al confirmar, no por tecla. */
  const [ufAvisoInput, setUfAvisoInput] = useState<string>('')

  useEffect(() => {
    // Una UF ingresada a mano no la pisa la respuesta tardía de mindicador (P-09)
    if (uf && !ufLoading && !ufEditadaAManoRef.current) {
      setUfValor(uf)
      setUfInput(uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
  }, [uf, ufLoading])

  const fmtUF = (v: number) =>
    v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /** Único camino para aplicar una UF escrita a mano (barra y header). Fuera de rango pide confirmación (P-10). */
  const aplicarUFManual = (texto: string): boolean => {
    const num = parsearUF(texto)
    if (num === null) return false
    if (
      ufFueraDeRango(num) &&
      !window.confirm(
        `La UF ingresada ($${fmtUF(num)}) está fuera del rango esperado ($30.000 – $60.000). ¿Aplicarla de todas formas?`,
      )
    ) {
      return false
    }
    setUfValor(num)
    ufEditadaAManoRef.current = true
    setUfEditadaAMano(true)
    setUfInput(fmtUF(num))
    return true
  }

  const abrirEdicionUF = () => {
    const texto = ufLoading ? '' : fmtUF(global.uf_valor_clp)
    ufInputAlAbrirRef.current = texto
    ufEdicionCanceladaRef.current = false
    setUfInput(texto)
    setEditingUF(true)
  }

  const cerrarEdicionUF = () => {
    const cancelada = ufEdicionCanceladaRef.current
    ufEdicionCanceladaRef.current = false
    setEditingUF(false)
    // Sin cambios no cuenta como edición manual
    if (cancelada || ufInput === ufInputAlAbrirRef.current) {
      setUfInput(ufInputAlAbrirRef.current)
      return
    }
    if (!aplicarUFManual(ufInput)) setUfInput(ufInputAlAbrirRef.current)
  }

  const mostrarAvisoUF = debeAvisarUFRespaldo(esFallback, ufEditadaAMano, ufLoading)

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
              onChange={(e) => setUfInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  ufEdicionCanceladaRef.current = true
                  e.currentTarget.blur()
                }
              }}
              onBlur={cerrarEdicionUF}
              autoFocus
            />
          ) : (
            <span
              className="uf-value"
              onClick={abrirEdicionUF}
              title="Clic para editar manualmente"
              style={{ cursor: 'pointer' }}
            >
              {ufLoading ? '...' : `$${global.uf_valor_clp.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          )}
          {ufLoading && <div className="loading-spinner" style={{ width: 14, height: 14 }} />}
          {!ufLoading && (
            <span style={{ fontSize: 10, color: esFallback && !ufEditadaAMano ? '#f59e0b' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {ufEditadaAMano ? (
                <span title="UF ingresada manualmente">✎ ingresada a mano</span>
              ) : esFallback ? (
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

      {/* Aviso de UF de respaldo: fuera de .header-center para que se vea en cualquier ancho */}
      {mostrarAvisoUF && (
        <div className="uf-aviso" role="alert">
          <span>
            ⚠️ No se pudo obtener la UF del día desde mindicador.cl. Se está usando un valor de
            respaldo (${fmtUF(uf)}) que no es el de hoy. Ingresa la UF del día:
          </span>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              aplicarUFManual(ufAvisoInput)
            }}
          >
            <input
              value={ufAvisoInput}
              onChange={(e) => setUfAvisoInput(e.target.value)}
              placeholder="Ej: 41.173,33"
              inputMode="decimal"
              aria-label="UF del día"
            />
            <button type="submit">Usar</button>
          </form>
        </div>
      )}

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
