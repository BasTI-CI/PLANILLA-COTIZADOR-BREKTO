import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { calcularDiversificacion, calcularIvaTotal } from '@/lib/engines/calculosDiversificacion'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import { devolucionIvaPrecioDeptoClp, precioCompraDeptoUf } from '@/lib/engines/precioCompra'
import TablaCashflow60m from './TablaCashflow60m'

const formatCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`
const formatUF = (v: number) => `${v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`

/** Muestra miles es-CL sin decimales; parsea dígitos al guardar. */
function parseClpDigits(raw: string): number {
  const d = raw.replace(/\D/g, '')
  return d === '' ? 0 : parseInt(d, 10)
}

function formatClpInputValue(n: number): string {
  if (!Number.isFinite(n) || n === 0) return ''
  return Math.round(Math.abs(n)).toLocaleString('es-CL')
}

function clampMesEntrega(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(60, Math.max(1, Math.round(n)))
}

/** Input entero 1–60: escritura manual cómoda (sin flechas); valida al salir del campo. */
function MesEntregaFlujoInput({
  id,
  mes,
  onCommit,
}: {
  id: string
  mes: number | null
  onCommit: (n: number | null) => void
}) {
  const [text, setText] = useState(() => (mes == null ? '' : String(clampMesEntrega(mes))))
  useEffect(() => {
    setText(mes == null ? '' : String(clampMesEntrega(mes)))
  }, [mes])

  const commit = () => {
    const d = text.replace(/\D/g, '')
    if (d === '') {
      onCommit(null)
      setText('')
      return
    }
    const n = clampMesEntrega(parseInt(d, 10))
    onCommit(n)
    setText(String(n))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
      <span
        style={{
          flexShrink: 0,
          alignSelf: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          padding: '0 4px',
        }}
        aria-hidden
      >
        M
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        id={id}
        aria-describedby={`${id}-hint`}
        aria-label="Mes de entrega, entero entre 1 y 60"
        placeholder="1–60"
        className="form-input"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 16,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}
        value={text}
        onChange={(e) => {
          const raw = e.target.value
          const d = raw.replace(/\D/g, '')
          if (d === '') {
            setText('')
            return
          }
          let n = parseInt(d, 10)
          if (n > 60) n = 60
          setText(String(n))
          if (n >= 1 && n <= 60) onCommit(n)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

export default function ModuloFlujo() {
  const {
    cotizaciones, global, diversificacion,
    cotizacion_activa_idx, setCotizacionActiva,
    setDiversificacion, setCalificaIva, setMesEntregaFlujo,
  } = useAppStore()

  const uf = global.uf_valor_clp
  const cotizacionesActivas = cotizaciones.filter(c => c.activa)
  const letras = ['A', 'B', 'C', 'D']

  const tabla60 = cotizacionesActivas.length > 0
    ? calcularDiversificacion(diversificacion, cotizaciones, uf)
    : []

  const iva_auto = calcularIvaTotal(cotizaciones, uf)
  let sumaPrecioDeptoIvaUf = 0
  for (const c of cotizaciones) {
    if (!c.activa || !c.califica_iva) continue
    sumaPrecioDeptoIvaUf += precioCompraDeptoUf(c.propiedad)
  }

  const ivaReferencia = diversificacion.diversif_iva_manual_override
    ? diversificacion.diversif_iva_total_clp
    : calcularIvaTotal(cotizaciones, uf)

  const mesesEntrega = [
    ...new Set(
      cotizacionesActivas
        .map((c) => c.mes_entrega_flujo)
        .filter((m): m is number => m != null)
    ),
  ].sort((a, b) => a - b)
  const mesesIVA = [
    ...new Set(
      cotizacionesActivas
        .filter((c) => c.califica_iva && c.mes_entrega_flujo != null)
        .map((c) => (c.mes_entrega_flujo as number) + 5)
        .filter((m) => m >= 1 && m <= 60)
    ),
  ].sort((a, b) => a - b)

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div className="cotizacion-tabs">
        {cotizaciones.map((c, idx) => (
          <button key={c.id}
            className={`cotizacion-tab ${cotizacion_activa_idx === idx ? 'active' : ''}`}
            onClick={() => setCotizacionActiva(idx)}>
            Cotización {letras[idx]}
            {c.activa && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>✓</span>}
          </button>
        ))}
      </div>

      {cotizacionesActivas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <h3>Completa al menos una cotización</h3>
          <p style={{ fontSize: 13 }}>Necesitas tener una cotización activa para proyectar el flujo de diversificación.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🧾 Devolución IVA y mes de entrega (por unidad)</h3>
              <span className="badge badge-muted">15% sobre precio compra depto (CLP) · IVA en M entrega + 5</span>
            </div>
            {sumaPrecioDeptoIvaUf > 0 && (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                Base acumulada para devolución IVA (precio de compra del depto, unidades con ✓; sin est./bod.):{' '}
                <strong style={{ color: 'var(--color-text)' }}>{formatUF(sumaPrecioDeptoIvaUf)}</strong>
                {' · '}
                {formatCLP(sumaPrecioDeptoIvaUf * uf)} — el valor de escrituración puede incluir bono pie bancario; el IVA se calcula sobre la transacción del depto.
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {cotizacionesActivas.map((c) => {
                const idx = cotizaciones.findIndex((x) => x.id === c.id)
                const r = calcularResultadosCotizacion(c, uf)
                const iva_unidad = devolucionIvaPrecioDeptoClp(c.propiedad, uf)
                const mesIva =
                  c.mes_entrega_flujo != null ? c.mes_entrega_flujo + 5 : null
                return (
                  <div key={c.id}
                    style={{
                      padding: '12px 16px',
                      background: c.califica_iva ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-alt)',
                      border: `1px solid ${c.califica_iva ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      onClick={() => idx >= 0 && setCalificaIva(idx, !c.califica_iva)}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 4,
                        border: `2px solid ${c.califica_iva ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
                        background: c.califica_iva ? '#10b981' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0,
                      }}>
                        {c.califica_iva ? '✓' : ''}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          Cotización {letras[c.id]}
                          <span style={{ marginLeft: 6, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                            {c.propiedad.proyecto_nombre.split(' ')[0]} U{c.propiedad.unidad_numero}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: c.califica_iva ? '#10b981' : 'var(--color-text-muted)', marginTop: 2 }}>
                          {c.califica_iva
                            ? mesIva != null
                              ? `Dev. IVA: ${formatCLP(iva_unidad)} · Inyección M${mesIva}`
                              : `Dev. IVA: ${formatCLP(iva_unidad)} · Indica mes de entrega para M IVA`
                            : 'No califica a dev. IVA'}
                        </div>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }} onClick={(e) => e.stopPropagation()}>
                      <label className="form-label" htmlFor={`mes-entrega-${c.id}`}>
                        Mes de entrega del departamento
                      </label>
                      <MesEntregaFlujoInput
                        id={`mes-entrega-${c.id}`}
                        mes={c.mes_entrega_flujo}
                        onCommit={(n) => idx >= 0 && setMesEntregaFlujo(idx, n)}
                      />
                      <span id={`mes-entrega-${c.id}-hint`} style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block', marginTop: 6, lineHeight: 1.4 }}>
                        Número entero <strong>1 a 60</strong> (mes dentro del horizonte de 60 meses). Flujo propio de esta unidad
                        {mesIva != null ? (
                          <>; devolución IVA en <strong>M{Math.min(mesIva, 60)}</strong>.</>
                        ) : (
                          <>; con IVA marcado, la devolución se programa en <strong>M entrega + 5</strong> una vez indiques el mes.</>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            {iva_auto > 0 && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Total devolución IVA automática</span>
                <span style={{ color: '#10b981', fontWeight: 700, fontSize: 15 }}>{formatCLP(iva_auto)}</span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💰 Parámetros — Diversificación de Ahorros</h3>
              <span className="badge badge-muted">60 meses</span>
            </div>
            <div className="card-grid-3">
              <div className="form-group">
                <label className="form-label">Capital inicial ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="form-input"
                  placeholder="0"
                  value={formatClpInputValue(diversificacion.diversif_capital_inicial_clp)}
                  onChange={(e) => setDiversificacion({ diversif_capital_inicial_clp: parseClpDigits(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ahorro mensual ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="form-input"
                  placeholder="0"
                  value={formatClpInputValue(diversificacion.diversif_ahorro_mensual_clp)}
                  onChange={(e) => setDiversificacion({ diversif_ahorro_mensual_clp: parseClpDigits(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tasa mensual (%)</label>
                <div className="form-input-group">
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    className="form-input input-no-spinner"
                    value={(diversificacion.diversif_tasa_mensual * 100).toFixed(1)}
                    onChange={(e) => setDiversificacion({ diversif_tasa_mensual: (parseFloat(e.target.value) || 0) / 100 })}
                  />
                  <span className="suffix">%</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Gastos operacionales ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="form-input"
                  placeholder="0"
                  value={formatClpInputValue(diversificacion.diversif_gastos_operacionales_clp)}
                  onChange={(e) => setDiversificacion({ diversif_gastos_operacionales_clp: parseClpDigits(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Costes amoblado y otros ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="form-input"
                  placeholder="0"
                  value={formatClpInputValue(diversificacion.diversif_amoblado_otros_clp)}
                  onChange={(e) => setDiversificacion({ diversif_amoblado_otros_clp: parseClpDigits(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>IVA manual</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox"
                      checked={diversificacion.diversif_iva_manual_override}
                      onChange={(e) => setDiversificacion({ diversif_iva_manual_override: e.target.checked })}
                    />
                    Sobrescribir
                  </label>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="form-input"
                  placeholder="0"
                  value={
                    diversificacion.diversif_iva_manual_override
                      ? formatClpInputValue(diversificacion.diversif_iva_total_clp)
                      : formatClpInputValue(iva_auto)
                  }
                  readOnly={!diversificacion.diversif_iva_manual_override}
                  onChange={(e) => diversificacion.diversif_iva_manual_override && setDiversificacion({ diversif_iva_total_clp: parseClpDigits(e.target.value) })}
                  style={{ opacity: diversificacion.diversif_iva_manual_override ? 1 : 0.7 }}
                />
              </div>
            </div>
          </div>

          {tabla60.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📋 Proyección Flujo de Caja — 60 Meses</h3>
              </div>
              <TablaCashflow60m
                tabla={tabla60}
                mesesEntrega={mesesEntrega}
                mesesIVA={mesesIVA}
                resumenContexto={{
                  capitalInicialClp: diversificacion.diversif_capital_inicial_clp,
                  tasaMensualDecimal: diversificacion.diversif_tasa_mensual,
                  gastosOperacionalesClp: diversificacion.diversif_gastos_operacionales_clp,
                  amobladoOtrosClp: diversificacion.diversif_amoblado_otros_clp,
                  ahorroMensualClp: diversificacion.diversif_ahorro_mensual_clp,
                  ivaTotalReferenciaClp: ivaReferencia,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
