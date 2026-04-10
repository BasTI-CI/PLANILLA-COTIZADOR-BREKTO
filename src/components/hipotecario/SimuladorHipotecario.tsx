import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'

const formatUF = (v: number) => `${v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`
const formatCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

interface Props { cotizacionId: number }

export default function SimuladorHipotecario({ cotizacionId }: Props) {
  const { cotizaciones, global, setHipotecario } = useAppStore()
  const cot = cotizaciones[cotizacionId]
  const uf = global.uf_valor_clp
  const [showTabla, setShowTabla] = useState(false)

  if (!cot?.activa) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏦</div>
        <h3>Primero completa la cotización</h3>
        <p style={{ fontSize: 13 }}>Selecciona o ingresa una unidad en la Cotización para activar el simulador.</p>
      </div>
    )
  }

  const hip = cot.hipotecario
  const res = calcularResultadosCotizacion(cot, uf)
  const r = res.hipotecario
  const p = cot.propiedad

  // Crédito y pie se definen sobre valor de escrituración (variables_calculo.md §1.0.0).
  const precio_compra_total_uf = res.precio_compra_total_uf
  const valor_escritura_uf = res.valor_escritura_uf
  const valor_tasacion_uf = res.valor_tasacion_uf
  const monto_financiado_uf = r.monto_credito_uf
  const pie_doc_uf = res.pie_total_uf
  const tiene_bono_descuento = res.beneficio_inmobiliario_uf > 0

  const pct_financiado =
    valor_escritura_uf > 0 ? (monto_financiado_uf / valor_escritura_uf) * 100 : 0
  const pct_pie_doc =
    valor_escritura_uf > 0 ? (pie_doc_uf / valor_escritura_uf) * 100 : 0

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span className="badge badge-blue">Cotización {String.fromCharCode(65 + cotizacionId)}</span>
        <span className="badge badge-gold">{p.proyecto_nombre}</span>
        <span className="badge badge-muted">Unidad {p.unidad_numero}</span>
      </div>

      {/* ── Parámetros ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏦 Parámetros del Crédito Hipotecario</h3>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sistema Francés (cuota fija)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Tasa Anual (%)</label>
            <div className="form-input-group">
              <input type="number" min={1} max={20} step={0.01}
                value={(hip.hipotecario_tasa_anual * 100).toFixed(2)}
                onChange={(e) => setHipotecario(cotizacionId, { hipotecario_tasa_anual: (parseFloat(e.target.value) || 0) / 100 })} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Plazo</label>
            <div className="form-input-group">
              <input type="number" min={5} max={30} step={5}
                value={hip.hipotecario_plazo_anos}
                onChange={(e) => setHipotecario(cotizacionId, { hipotecario_plazo_anos: parseInt(e.target.value) || 30 })} />
              <span className="suffix">años</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Seg. Desgravamen (UF)</label>
            <div className="form-input-group">
              <input type="number" min={0} max={1} step={0.001}
                value={hip.hipotecario_seg_desgravamen_uf}
                onChange={(e) => setHipotecario(cotizacionId, { hipotecario_seg_desgravamen_uf: parseFloat(e.target.value) || 0 })} />
              <span className="suffix">UF</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Seg. Sismos (UF)</label>
            <div className="form-input-group">
              <input type="number" min={0} max={1} step={0.001}
                value={hip.hipotecario_seg_sismos_uf}
                onChange={(e) => setHipotecario(cotizacionId, { hipotecario_seg_sismos_uf: parseFloat(e.target.value) || 0 })} />
              <span className="suffix">UF</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Resultado del Crédito ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">💳 Resultado del Crédito</h3>
        </div>

        {/* ── Precio de compra / tasación / escrituración / crédito ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <div className="stat-item">
            <span className="stat-label">Precio de compra (total UF)</span>
            <span className="stat-value">{formatUF(precio_compra_total_uf)}</span>
            <span className="stat-sub">{formatCLP(precio_compra_total_uf * uf)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Valor tasación depto (UF)</span>
            <span className="stat-value">{formatUF(valor_tasacion_uf)}</span>
            <span className="stat-sub">{formatCLP(valor_tasacion_uf * uf)}</span>
          </div>
          <div className="stat-item" style={tiene_bono_descuento ? { borderLeft: '2px solid var(--color-gold)', paddingLeft: 10 } : {}}>
            <span className="stat-label">
              Valor escrituración (UF)
              {tiene_bono_descuento && (
                <span style={{ marginLeft: 5, fontSize: 9, background: 'rgba(212,168,67,0.18)', padding: '1px 5px', borderRadius: 3, color: 'var(--color-gold)' }}>
                  base banco
                </span>
              )}
            </span>
            <span className="stat-value gold">{formatUF(valor_escritura_uf)}</span>
            <span className="stat-sub">{formatCLP(valor_escritura_uf * uf)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Monto financiado</span>
            <span className="stat-value blue">{formatUF(monto_financiado_uf)}</span>
            <span className="stat-sub">{formatCLP(r.monto_credito_clp)}</span>
          </div>
        </div>

        {/* ── Dividendo Mensual destacado ── */}
        <div style={{
          marginTop: 12,
          padding: '14px 18px',
          background: 'rgba(212,168,67,0.06)',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          border: '1px solid rgba(212,168,67,0.15)',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Dividendo Mensual (con seguros)</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--color-gold)' }}>{formatUF(r.dividendo_total_uf)}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatCLP(r.dividendo_total_clp)}/mes</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)' }}>
            <div>Tasa {(hip.hipotecario_tasa_anual * 100).toFixed(2)}% · {hip.hipotecario_plazo_anos} años</div>
            <div style={{ marginTop: 3 }}>Incluye seguros de desgravamen, vida y sismos</div>
          </div>
        </div>

        {/* ── Barra visual Pie real vs Financiamiento ── */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>
              Pie documentado: {formatUF(pie_doc_uf)} ({pct_pie_doc.toFixed(1)}% del valor escrituración)
            </span>
            <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
              Crédito: {formatUF(monto_financiado_uf)} ({pct_financiado.toFixed(1)}% del valor escrituración)
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--color-surface-alt)', overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${pct_pie_doc}%`,
              background: 'var(--color-gold)',
              transition: 'width 0.4s ease',
              minWidth: pct_pie_doc > 0 ? 4 : 0,
            }} />
            <div style={{ flex: 1, background: 'var(--color-accent)' }} />
          </div>
          {tiene_bono_descuento && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚡ Beneficio inmobiliario {formatUF(res.beneficio_inmobiliario_uf)} UF (sobre tasación). El crédito se calcula sobre <strong>valor escrituración</strong> ({formatUF(valor_escritura_uf)}), no sobre precio de compra ({formatUF(precio_compra_total_uf)}).
            </div>
          )}
          <div style={{ marginTop: 3, fontSize: 10, color: 'var(--color-text-muted)' }}>
            La barra reparte pie vs crédito sobre valor escrituración ({formatUF(valor_escritura_uf)} UF).
          </div>
        </div>
      </div>

      {/* ── Tabla de amortización ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Tabla de Amortización</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setShowTabla(!showTabla)}>
            {showTabla ? '▲ Ocultar' : '▼ Ver tabla completa'}
          </button>
        </div>
        {showTabla && (
          <div className="table-wrapper" style={{ maxHeight: 400 }}>
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Capital (UF)</th>
                  <th>Interés (UF)</th>
                  <th>Seg. Vida</th>
                  <th>Seg. Desgrav.</th>
                  <th>Seg. Sismos</th>
                  <th>Cuota Total UF</th>
                  <th>Cuota Total $</th>
                  <th>Saldo (UF)</th>
                </tr>
              </thead>
              <tbody>
                {r.tabla_amortizacion.map((fila) => (
                  <tr key={fila.mes}>
                    <td>{fila.mes}</td>
                    <td>{fila.capital_uf.toFixed(3)}</td>
                    <td>{fila.interes_uf.toFixed(3)}</td>
                    <td>{fila.seg_vida_uf.toFixed(4)}</td>
                    <td>{fila.seg_desgravamen_uf.toFixed(4)}</td>
                    <td>{fila.seg_sismos_uf.toFixed(4)}</td>
                    <td style={{ fontWeight: 600 }}>{fila.cuota_total_uf.toFixed(3)}</td>
                    <td style={{ color: 'var(--color-gold)' }}>{fila.cuota_total_clp.toLocaleString('es-CL')}</td>
                    <td>{fila.saldo_uf.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
