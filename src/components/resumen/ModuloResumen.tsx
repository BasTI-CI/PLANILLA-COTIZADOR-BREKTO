import { useAppStore } from '@/store/useAppStore'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

const COLORS_GOLD = ['#d4a843', '#3b82f6', '#10b981', '#f59e0b']

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1a2238',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  color: '#f1f5f9',
}

const fmtUF = (v: number) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`
const fmtCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

export default function ModuloResumen() {
  const { cotizaciones, global } = useAppStore()
  const uf = global.uf_valor_clp
  const activas = cotizaciones.filter((c) => c.activa)

  if (activas.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h3>Sin cotizaciones para mostrar</h3>
        <p style={{ fontSize: 13 }}>Completa al menos una cotización para ver el resumen de inversión.</p>
      </div>
    )
  }

  // Resultados calculados para cada cotización activa
  const resultados = activas.map((c) => calcularResultadosCotizacion(c, uf))

  // ── Datos gráfico 1: barras comparativas ──
  const comparativaData = activas.map((c, i) => {
    const r = resultados[i]
    return {
      name: `${c.propiedad.proyecto_nombre.split(' ')[0]} U${c.propiedad.unidad_numero}`,
      'Pie': Math.round(r.pie_total_uf * 100) / 100,
      'Crédito': Math.round(r.hipotecario.monto_credito_uf * 100) / 100,
    }
  })

  // ── Datos gráfico 2: proyección plusvalía 5 años ──
  const plusvaliaData = Array.from({ length: 6 }, (_, i) => {
    const obj: Record<string, number | string> = { ano: `Año ${i}` }
    activas.forEach((c, idx) => {
      const precioBase = c.propiedad.precio_compra_uf
      const val = precioBase * Math.pow(1 + c.rentabilidad.plusvalia_anual_pct, i)
      obj[`${c.propiedad.proyecto_nombre.split(' ')[0]}`] = Math.round(val * 100) / 100
    })
    return obj
  })

  // ── Datos gráfico 3: pie chart estructura inversión ──
  const c0 = activas[0]
  const r0 = resultados[0]
  const pieData = [
    { name: 'Pie', value: Math.round(r0.pie_total_uf * 100) / 100 },
    { name: 'Crédito', value: Math.round(r0.hipotecario.monto_credito_uf * 100) / 100 },
  ]

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Tabla comparativa ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Comparativa de Cotizaciones</h3>
          <span className="badge badge-gold">{activas.length} cotización{activas.length > 1 ? 'es' : ''} activa{activas.length > 1 ? 's' : ''}</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cot.</th>
                <th>Proyecto / Unidad</th>
                <th>Tipología</th>
                <th>m²</th>
                <th>Precio Compra</th>
                <th>Escrituración</th>
                <th>Pie</th>
                <th>Dividendo</th>
                <th>Plusvalía</th>
                <th>Cap Rate</th>
                <th>Cap Rate AirBnB</th>
              </tr>
            </thead>
            <tbody>
              {activas.map((c, i) => {
                const r = resultados[i]
                return (
                  <tr key={c.id}>
                    <td><span className="badge badge-blue">{String.fromCharCode(65 + c.id)}</span></td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{c.propiedad.proyecto_nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        Unidad {c.propiedad.unidad_numero} · {c.propiedad.proyecto_comuna}
                      </div>
                    </td>
                    <td>{c.propiedad.unidad_tipologia}</td>
                    <td>{c.propiedad.unidad_sup_total_m2} m²</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{fmtUF(c.propiedad.precio_compra_uf)}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{fmtCLP(c.propiedad.precio_compra_uf * uf)}</div>
                    </td>
                    <td>{fmtUF(r.escrituracion_uf)}</td>
                    <td>
                      <span className="badge badge-gold">{(c.pie.pie_pct * 100).toFixed(0)}%</span>
                      <div style={{ fontSize: 11 }}>{fmtUF(r.pie_total_uf)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{fmtUF(r.hipotecario.dividendo_total_uf)}</div>
                      <div style={{ fontSize: 11 }}>{fmtCLP(r.hipotecario.dividendo_total_clp)}</div>
                    </td>
                    <td style={{ color: 'var(--color-success)' }}>
                      {(c.rentabilidad.plusvalia_anual_pct * 100).toFixed(1)}% anual
                    </td>
                    <td style={{ color: 'var(--color-success)' }}>
                      {(r.arriendo.cap_rate_anual_pct * 100).toFixed(2)}%
                    </td>
                    <td style={{ color: 'var(--color-gold)' }}>
                      {(r.arriendo.airbnb_cap_rate_anual_pct * 100).toFixed(2)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3 Gráficos ── */}
      <div className="graficos-grid">

        {/* Gráfico 1: Estructura de inversión barras */}
        <div className="grafico-card">
          <div className="grafico-title">📊 Estructura de Inversión por Cotización</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparativaData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v} UF`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} UF`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Pie" fill="#d4a843" stackId="a" radius={[0,0,3,3]} />
              <Bar dataKey="Crédito" fill="#3b82f6" stackId="a" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 2: Proyección plusvalía 5 años (líneas) */}
        <div className="grafico-card">
          <div className="grafico-title">📈 Proyección Plusvalía 5 Años</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={plusvaliaData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="ano" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `${v.toLocaleString()} UF`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} UF`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activas.map((c, i) => (
                <Line
                  key={c.id}
                  type="monotone"
                  dataKey={c.propiedad.proyecto_nombre.split(' ')[0]}
                  stroke={COLORS_GOLD[i % COLORS_GOLD.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 3: Pie chart estructura */}
        <div className="grafico-card">
          <div className="grafico-title">🥧 Estructura — {c0.propiedad.proyecto_nombre.split(' ')[0]}</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS_GOLD[index % COLORS_GOLD.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} UF`]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            {pieData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS_GOLD[i] }} />
                <span style={{ color: 'var(--color-text-muted)' }}>{d.name}:</span>
                <span style={{ fontWeight: 700 }}>{fmtUF(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPIs por cotización ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🎯 KPIs de Inversión</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {activas.map((c, i) => {
            const r = resultados[i]
            return (
              <div key={c.id} className="card card-sm" style={{ background: 'var(--color-bg-secondary)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-gold)', marginBottom: 8 }}>
                  Cotización {String.fromCharCode(65 + c.id)} — {c.propiedad.proyecto_nombre}
                </div>
                <div className="stat-item" style={{ marginBottom: 6 }}>
                  <span className="stat-label">Plusvalía proyectada 5 años</span>
                  <span className="stat-value green">{fmtUF(r.plusvalia.precio_venta_5anos_uf)}</span>
                </div>
                <div className="stat-item" style={{ marginBottom: 6 }}>
                  <span className="stat-label">Ganancia venta</span>
                  <span className="stat-value">{fmtUF(r.plusvalia.ganancia_venta_uf)}</span>
                  <span className="stat-sub">{fmtCLP(r.plusvalia.ganancia_venta_clp)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Resultado mensual arriendo</span>
                  <span className="stat-value" style={{ color: r.arriendo.resultado_mensual_clp >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {fmtCLP(r.arriendo.resultado_mensual_clp)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
