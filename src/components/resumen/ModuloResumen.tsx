import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import { calcularDiversificacion } from '@/lib/engines/calculosDiversificacion'
import { bonoPieUf, pieAPagarUf } from '@/lib/engines/desglosePieUf'
import {
  seriePatrimonioTotalUf,
  liquidezVentaUnidadClp,
} from '@/lib/engines/resumenGraficos'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1a2238',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  color: '#f1f5f9',
}

const fmtUF = (v: number) =>
  `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`
const fmtCLP = (v: number) =>
  `$${Math.round(v).toLocaleString('es-CL')}`

export default function ModuloResumen() {
  const { cotizaciones, global, diversificacion } = useAppStore()
  const uf = global.uf_valor_clp
  const activas = cotizaciones.filter((c) => c.activa)

  /** Si no hay clave, se asume «sí vende» (true). Evita useEffect según `activas`: un nuevo array cada render disparaba setState en bucle y tumba la página. */
  const [vendeUnidad, setVendeUnidad] = useState<Record<number, boolean>>({})

  if (activas.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h3>Sin cotizaciones para mostrar</h3>
        <p style={{ fontSize: 13 }}>
          Completa al menos una cotización para ver el resumen de inversión.
        </p>
      </div>
    )
  }

  const resultados = activas.map((c) => calcularResultadosCotizacion(c, uf))

  const tablaDiv = useMemo(
    () => calcularDiversificacion(diversificacion, cotizaciones, uf),
    [diversificacion, cotizaciones, uf]
  )

  const dataPatrimonio = useMemo(
    () => seriePatrimonioTotalUf(activas, resultados),
    [activas, resultados]
  )

  const dataCajaDiversificacion = useMemo(
    () =>
      tablaDiv.map((f) => ({
        mes: f.mes,
        caja: f.capital_fin,
      })),
    [tablaDiv]
  )

  const liquidezPorUnidad = useMemo(
    () => activas.map((c, i) => liquidezVentaUnidadClp(c, resultados[i], uf)),
    [activas, resultados, uf]
  )

  const extraVentaM60 = useMemo(() => {
    return activas.reduce((sum, c, i) => {
      if (vendeUnidad[c.id] === false) return sum
      return sum + liquidezPorUnidad[i]
    }, 0)
  }, [activas, vendeUnidad, liquidezPorUnidad])

  const dataFinancieroFinal = useMemo(() => {
    return dataCajaDiversificacion.map((row, idx) =>
      idx === dataCajaDiversificacion.length - 1
        ? { ...row, caja: row.caja + extraVentaM60 }
        : row
    )
  }, [dataCajaDiversificacion, extraVentaM60])

  const patrimonioFinalUf =
    dataPatrimonio[dataPatrimonio.length - 1]?.patrimonioUf ?? 0
  const cajaFinalDiv =
    dataCajaDiversificacion[dataCajaDiversificacion.length - 1]?.caja ?? 0
  const resultadoFinancieroFinal =
    dataFinancieroFinal[dataFinancieroFinal.length - 1]?.caja ?? 0

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div
        className="card"
        style={{
          padding: '12px 16px',
          background: 'rgba(212,168,67,0.06)',
          border: '1px solid rgba(212,168,67,0.2)',
        }}
      >
        <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>
          <strong style={{ color: 'var(--color-gold)' }}>Criterios del resumen:</strong>{' '}
          <strong>Precio de compra</strong> = depto + est. + bod. (pre-BI).{' '}
          <strong>Patrimonio</strong>: año 0 = precio de compra; luego valor escrituración con plusvalía anual (primer tramo incorpora paso a base escrituración/tasación + año 1).{' '}
          <strong>Caja diversificación</strong> = motor 60 meses del módulo Flujo.{' '}
          <strong>Venta M60</strong>: precio (escritura × (1+g)^5) − saldo crédito a mes 60 − adelanto IVA (15% × precio compra depto) si califica.
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Comparativa de Cotizaciones</h3>
          <span className="badge badge-gold">
            {activas.length} cotización{activas.length > 1 ? 'es' : ''} activa
            {activas.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="table-wrapper">
          <table className="table-comparativa">
            <thead>
              <tr>
                <th>Cot.</th>
                <th>Proyecto / Unidad</th>
                <th>Tipología</th>
                <th>m²</th>
                <th>Precio de compra (UF)</th>
                <th>Valor tasación depto</th>
                <th>Valor escrituración</th>
                <th>Pie doc.</th>
                <th>Bono pie</th>
                <th>Pie a pagar</th>
                <th>Dividendo</th>
                <th>Plusvalía</th>
                <th>Cap Rate</th>
                <th>Cap Rate AirBnB</th>
              </tr>
            </thead>
            <tbody>
              {activas.map((c, i) => {
                const r = resultados[i]
                const bonoPie = bonoPieUf(r.valor_escritura_uf, c.pie)
                const piePagar = pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, c.pie)
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="badge badge-blue">{String.fromCharCode(65 + c.id)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack cell-stack--left">
                        <span className="cell-stack__line1">{c.propiedad.proyecto_nombre}</span>
                        <span className="cell-stack__line2">
                          Unidad {c.propiedad.unidad_numero} · {c.propiedad.proyecto_comuna}
                        </span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__ufline">{c.propiedad.unidad_tipologia}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__ufline">{c.propiedad.unidad_sup_total_m2} m²</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__line1">{fmtUF(r.precio_compra_total_uf)}</span>
                        <span className="cell-stack__line2">depto + est. + bod.</span>
                        <span className="cell-stack__line2">{fmtCLP(r.precio_compra_total_uf * uf)}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__ufline">{fmtUF(r.valor_tasacion_uf)}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__ufline">{fmtUF(r.valor_escritura_uf)}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="badge badge-gold">{(c.pie.pie_pct * 100).toFixed(0)}%</span>
                        <span className="cell-stack__ufline" style={{ color: 'var(--color-gold)' }}>{fmtUF(r.pie_total_uf)}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__line1">{fmtUF(bonoPie)}</span>
                        <span className="cell-stack__line2">{fmtCLP(bonoPie * uf)}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__line1" style={{ color: 'var(--color-gold)' }}>{fmtUF(piePagar)}</span>
                        <span className="cell-stack__line2">{fmtCLP(piePagar * uf)}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__line1" style={{ color: 'var(--color-gold)' }}>
                          {fmtUF(r.hipotecario.dividendo_total_uf)}
                        </span>
                        <span className="cell-stack__line2">{fmtCLP(r.hipotecario.dividendo_total_clp)}</span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__ufline" style={{ color: 'var(--color-success)' }}>
                          {(c.rentabilidad.plusvalia_anual_pct * 100).toFixed(1)}% <span style={{ fontWeight: 500, fontSize: 10 }}>anual</span>
                        </span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__ufline" style={{ color: 'var(--color-success)' }}>
                          {(r.arriendo.cap_rate_anual_pct * 100).toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="td-num">
                      <div className="cell-stack">
                        <span className="cell-stack__ufline" style={{ color: 'var(--color-gold)' }}>
                          {(r.arriendo.airbnb_cap_rate_anual_pct * 100).toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            lineHeight: 1.35,
            letterSpacing: '0.02em',
          }}
        >
          Gráficos de proyección de patrimonio, resultado financiero y diversificación de capital durante el ciclo de inversión
        </h2>
      </div>

      {/* a) Patrimonio */}
      <div className="grafico-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <div>
            <div className="grafico-title" style={{ marginBottom: 4 }}>
              Proyección de valorización de patrimonio por plusvalía en cinco años
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 560 }}>
              Eje X: semestres 0–10. Año 0 = precio de compra; el primer tramo refleja el salto a base escrituración/tasación y plusvalía del primer año; después pendiente anual constante (tasa de la cotización).
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gold)', whiteSpace: 'nowrap' }}>
            Valor final del patrimonio: {fmtUF(patrimonioFinalUf)}
          </div>
        </div>
        <div className="chart-legend-top" aria-hidden>
          <div className="chart-legend-top__item">
            <span className="chart-legend-top__swatch" style={{ background: '#d4a843' }} />
            Patrimonio total (UF)
          </div>
        </div>
        <div style={{ width: '100%', height: 260, minHeight: 260, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 10,
              zIndex: 2,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(212,168,67,0.35)',
              fontSize: 11,
              fontWeight: 600,
              color: '#f1f5f9',
              maxWidth: '42%',
              lineHeight: 1.35,
            }}
          >
            Inicio (sem. 0): {fmtUF(dataPatrimonio[0]?.patrimonioUf ?? 0)}
          </div>
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 10,
              zIndex: 2,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(212,168,67,0.35)',
              fontSize: 11,
              fontWeight: 600,
              color: '#f1f5f9',
              maxWidth: '42%',
              textAlign: 'right',
              lineHeight: 1.35,
            }}
          >
            Final ciclo (sem. {dataPatrimonio[dataPatrimonio.length - 1]?.semestre ?? 10}):{' '}
            {fmtUF(dataPatrimonio[dataPatrimonio.length - 1]?.patrimonioUf ?? 0)}
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPatrimonio} margin={{ top: 4, right: 12, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="semestre"
                tick={{ fontSize: 10, fill: '#64748b' }}
                label={{ value: 'Semestre', position: 'bottom', offset: 0, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toLocaleString('es-CL')}` : '')}
                label={{ value: 'Valor de patrimonio (UF)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v) => [`${fmtUF(Number(v))}`, 'Patrimonio']}
                labelFormatter={(s) => `Semestre ${s}`}
              />
              <Line type="monotone" dataKey="patrimonioUf" name="Patrimonio total (UF)" stroke="#d4a843" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* b) Flujo de caja diversificación */}
      <div className="grafico-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <div>
            <div className="grafico-title" style={{ marginBottom: 4 }}>
              Proyección de caja en diversificación de capital e inversión inmobiliaria
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 560 }}>
              Caja disponible al cierre de cada mes según el mismo motor del módulo Flujo (60 meses).
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
            Resultado en caja por diversificación: {fmtCLP(cajaFinalDiv)}
          </div>
        </div>
        <div className="chart-legend-top" aria-hidden>
          <div className="chart-legend-top__item">
            <span className="chart-legend-top__swatch" style={{ background: '#3b82f6' }} />
            Caja diversificación (CLP)
          </div>
        </div>
        <div style={{ width: '100%', height: 260, minHeight: 260, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 10,
              zIndex: 2,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(59,130,246,0.4)',
              fontSize: 11,
              fontWeight: 600,
              color: '#f1f5f9',
              maxWidth: '42%',
              lineHeight: 1.35,
            }}
          >
            Inicio (mes 1): {fmtCLP(dataCajaDiversificacion[0]?.caja ?? 0)}
          </div>
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 10,
              zIndex: 2,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(59,130,246,0.4)',
              fontSize: 11,
              fontWeight: 600,
              color: '#f1f5f9',
              maxWidth: '42%',
              textAlign: 'right',
              lineHeight: 1.35,
            }}
          >
            Final ciclo (mes 60): {fmtCLP(dataCajaDiversificacion[dataCajaDiversificacion.length - 1]?.caja ?? 0)}
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataCajaDiversificacion} margin={{ top: 4, right: 12, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: '#64748b' }}
                label={{ value: 'Ciclo de inversión (meses)', position: 'bottom', offset: 0, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) =>
                  typeof v === 'number' && Number.isFinite(v)
                    ? `$${(v / 1_000_000).toFixed(0)}M`
                    : ''
                }
                label={{ value: 'Caja disponible (CLP)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v) => [fmtCLP(Number(v)), 'Caja']}
                labelFormatter={(m) => `Mes ${m}`}
              />
              <Line type="monotone" dataKey="caja" name="Caja diversificación" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* c) Financiero final + ventas */}
      <div className="grafico-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <div>
            <div className="grafico-title" style={{ marginBottom: 4 }}>
              Proyección de resultado financiero del ciclo de inversión
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 620 }}>
              Igual que la caja por diversificación; en el mes 60 se suma la venta de las unidades marcadas: (precio escritura × (1+g)^5 − saldo crédito a mes 60). Si califica IVA, se descuenta el adelanto de devolución (15% × precio de compra del solo departamento; sin est./bod.).
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gold)', whiteSpace: 'nowrap' }}>
            Resultado final de la inversión: {fmtCLP(resultadoFinancieroFinal)}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 14,
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', width: '100%' }}>
            Venta al mes 60 (incluir liquidez en el resultado final)
          </span>
          {activas.map((c, idx) => (
            <label
              key={c.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 13,
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={vendeUnidad[c.id] !== false}
                onChange={(e) =>
                  setVendeUnidad((v) => ({ ...v, [c.id]: e.target.checked }))
                }
              />
              <span>
                Unidad {idx + 1} — Cot. {String.fromCharCode(65 + c.id)} ·{' '}
                {c.propiedad.proyecto_nombre.split(' ')[0]} U{c.propiedad.unidad_numero}
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 6 }}>
                  (+{fmtCLP(liquidezPorUnidad[idx])} si se vende)
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="chart-legend-top" aria-hidden>
          <div className="chart-legend-top__item">
            <span className="chart-legend-top__swatch" style={{ background: '#10b981' }} />
            Resultado acumulado (CLP)
          </div>
        </div>
        <div style={{ width: '100%', height: 280, minHeight: 280, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 10,
              zIndex: 2,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(16,185,129,0.45)',
              fontSize: 11,
              fontWeight: 600,
              color: '#f1f5f9',
              maxWidth: '42%',
              lineHeight: 1.35,
            }}
          >
            Inicio (mes 1): {fmtCLP(dataFinancieroFinal[0]?.caja ?? 0)}
          </div>
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 10,
              zIndex: 2,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(16,185,129,0.45)',
              fontSize: 11,
              fontWeight: 600,
              color: '#f1f5f9',
              maxWidth: '42%',
              textAlign: 'right',
              lineHeight: 1.35,
            }}
          >
            Final ciclo (mes 60): {fmtCLP(dataFinancieroFinal[dataFinancieroFinal.length - 1]?.caja ?? 0)}
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataFinancieroFinal} margin={{ top: 4, right: 12, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: '#64748b' }}
                label={{ value: 'Ciclo de inversión (meses)', position: 'bottom', offset: 0, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) =>
                  typeof v === 'number' && Number.isFinite(v)
                    ? `$${(v / 1_000_000).toFixed(0)}M`
                    : ''
                }
                label={{ value: 'Resultado financiero (CLP)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v) => [fmtCLP(Number(v)), 'Resultado']}
                labelFormatter={(m) => `Mes ${m}`}
              />
              <Line type="monotone" dataKey="caja" name="Resultado acumulado" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                  <span
                    className="stat-value"
                    style={{
                      color:
                        r.arriendo.resultado_mensual_clp >= 0
                          ? 'var(--color-success)'
                          : 'var(--color-error)',
                    }}
                  >
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
