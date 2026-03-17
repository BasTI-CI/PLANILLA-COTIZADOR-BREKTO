import { useAppStore } from '@/store/useAppStore'
import { calcularDiversificacion } from '@/lib/engines/calculosDiversificacion'
import TablaCashflow60m from './TablaCashflow60m'

const formatCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`
const formatUF = (v: number) => `${v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`

export default function ModuloFlujo() {
  const {
    cotizaciones, global, diversificacion,
    cotizacion_activa_idx, setCotizacionActiva,
    setDiversificacion, setCalificaIva,
  } = useAppStore()

  const uf = global.uf_valor_clp
  const cotizacionesActivas = cotizaciones.filter(c => c.activa)
  const letras = ['A', 'B', 'C', 'D']

  const tabla60 = cotizacionesActivas.length > 0
    ? calcularDiversificacion(diversificacion, cotizaciones, uf)
    : []

  const cot = cotizaciones[cotizacion_activa_idx]

  // IVA auto-computado
  const iva_auto = cotizaciones
    .filter(c => c.activa && c.califica_iva)
    .reduce((sum, c) => sum + c.propiedad.precio_compra_uf * 0.15 * uf, 0)

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Selector cotización activa */}
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
          {/* ── Checkbox IVA por cotización ── */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🧾 Devolución IVA por Unidad</h3>
              <span className="badge badge-muted">15% del precio de compra</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {cotizacionesActivas.map((c) => {
                const iva_unidad = c.propiedad.precio_compra_uf * 0.15 * uf
                return (
                  <div key={c.id}
                    style={{
                      padding: '12px 16px',
                      background: c.califica_iva ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-alt)',
                      border: `1px solid ${c.califica_iva ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setCalificaIva(c.id, !c.califica_iva)}
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
                        {c.califica_iva ? `Dev. IVA: ${formatCLP(iva_unidad)}` : 'No califica a dev. IVA'}
                      </div>
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

          {/* ── Parámetros Diversificación ── */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💰 Parámetros — Diversificación de Ahorros</h3>
              <span className="badge badge-muted">60 meses</span>
            </div>
            <div className="card-grid-3">
              <div className="form-group">
                <label className="form-label">Capital inicial ($)</label>
                <input type="number" className="form-input"
                  value={diversificacion.diversif_capital_inicial_clp}
                  onChange={(e) => setDiversificacion({ diversif_capital_inicial_clp: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Ahorro mensual ($)</label>
                <input type="number" className="form-input"
                  value={diversificacion.diversif_ahorro_mensual_clp}
                  onChange={(e) => setDiversificacion({ diversif_ahorro_mensual_clp: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Tasa mensual (%)</label>
                <div className="form-input-group">
                  <input type="number" min={0} max={5} step={0.1}
                    value={(diversificacion.diversif_tasa_mensual * 100).toFixed(1)}
                    onChange={(e) => setDiversificacion({ diversif_tasa_mensual: (parseFloat(e.target.value) || 0) / 100 })} />
                  <span className="suffix">%</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mes entrega 1er dpto.</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min={1} max={60} className="form-input"
                    value={diversificacion.mes_entrega_primer_depto}
                    onChange={(e) => setDiversificacion({ mes_entrega_primer_depto: parseInt(e.target.value) || 1 })} />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>mes {diversificacion.mes_entrega_primer_depto}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Gasto escrituración ($)</label>
                <input type="number" className="form-input"
                  value={diversificacion.diversif_gasto_escrituracion_clp}
                  onChange={(e) => setDiversificacion({ diversif_gasto_escrituracion_clp: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>IVA manual</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox"
                      checked={diversificacion.diversif_iva_manual_override}
                      onChange={(e) => setDiversificacion({ diversif_iva_manual_override: e.target.checked })} />
                    Sobrescribir
                  </label>
                </label>
                <input type="number" className="form-input"
                  value={diversificacion.diversif_iva_manual_override ? diversificacion.diversif_iva_total_clp : iva_auto}
                  readOnly={!diversificacion.diversif_iva_manual_override}
                  onChange={(e) => setDiversificacion({ diversif_iva_total_clp: parseFloat(e.target.value) || 0 })}
                  style={{ opacity: diversificacion.diversif_iva_manual_override ? 1 : 0.7 }} />
              </div>
            </div>
          </div>

          {/* ── Tabla 60 meses con hitos ── */}
          {tabla60.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📋 Proyección Flujo de Caja — 60 Meses</h3>
              </div>
              <TablaCashflow60m
                tabla={tabla60}
                mesEntrega={diversificacion.mes_entrega_primer_depto}
                mesIVA={diversificacion.mes_entrega_primer_depto + 1}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

