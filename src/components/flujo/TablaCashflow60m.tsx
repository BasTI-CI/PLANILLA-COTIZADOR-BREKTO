import type { FilaDiversificacion } from '@/types'

interface Props {
  tabla: FilaDiversificacion[]
  mesEntrega: number
  mesIVA: number
  /** true = versión compacta para PDF (sin sticky header, sin interactividad) */
  pdfMode?: boolean
}

const fmtCLP = (v: number) =>
  `$${Math.round(Math.abs(v)).toLocaleString('es-CL')}${v < 0 ? ' ▼' : ''}`

// ─── Colores de hito ───────────────────────────────────────────────
// Fase 1 (pre-entrega): azul oscuro sutil
// Mes entrega: oro
// Mes IVA: verde esmeralda
// Cierres de año: separador visible
// Fase 2 (post-entrega): verde muy sutil
const COLOR_PRE_ENTREGA = 'rgba(59,130,246,0.07)'
const COLOR_POST_ENTREGA = 'rgba(16,185,129,0.07)'
const COLOR_MES_ENTREGA = 'rgba(212,168,67,0.22)'
const COLOR_MES_IVA = 'rgba(16,185,129,0.22)'
const COLOR_CIERRE_ANO = 'rgba(255,255,255,0.06)'
const BORDER_CIERRE_ANO = '2px solid rgba(255,255,255,0.18)'

function rowStyle(mes: number, mesEntrega: number, mesIVA: number): React.CSSProperties {
  if (mes === mesEntrega) return { background: COLOR_MES_ENTREGA }
  if (mes === mesIVA) return { background: COLOR_MES_IVA }
  if (mes % 12 === 0) return { background: COLOR_CIERRE_ANO, borderBottom: BORDER_CIERRE_ANO }
  return { background: mes < mesEntrega ? COLOR_PRE_ENTREGA : COLOR_POST_ENTREGA }
}

function rowIcon(mes: number, mesEntrega: number, mesIVA: number): string {
  if (mes === mesEntrega) return '🔑'
  if (mes === mesIVA) return '💰'
  if (mes % 12 === 0) return '📅'
  return ''
}

// ─── Resumen anual (sólo cierres de año) ─────────────────────────
function resumenesAnuales(tabla: FilaDiversificacion[]): {
  ano: number
  capitalFin: number
  ahorroAcum: number
  rentAcum: number
  egresoAcum: number
  ivaAcum: number
}[] {
  return [1, 2, 3, 4, 5].map((ano) => {
    const inicio = (ano - 1) * 12
    const slice = tabla.slice(inicio, inicio + 12)
    return {
      ano,
      capitalFin: tabla[inicio + 11]?.capital_fin ?? 0,
      ahorroAcum: slice.reduce((s, f) => s + f.ahorro_mensual, 0),
      rentAcum: slice.reduce((s, f) => s + f.rentabilizacion, 0),
      egresoAcum: slice.reduce((s, f) => s + f.egreso_cuotas, 0),
      ivaAcum: slice.reduce((s, f) => s + f.iva_inyeccion, 0),
    }
  })
}

export default function TablaCashflow60m({ tabla, mesEntrega, mesIVA, pdfMode = false }: Props) {
  if (tabla.length === 0) return null

  const resumenAnual = resumenesAnuales(tabla)
  const capitalFinal = tabla[59]?.capital_fin ?? 0
  const capitalInicial = tabla[0]?.capital_inicio ?? 0
  const gananciaTotal = tabla[59]?.ganancia_acumulada ?? 0
  const rentTotalPct = capitalInicial > 0 ? (gananciaTotal / capitalInicial) * 100 : 0

  const thStyle: React.CSSProperties = {
    position: pdfMode ? undefined : 'sticky',
    top: pdfMode ? undefined : 0,
    background: '#0f1628',
    zIndex: 10,
    padding: '8px 10px',
    fontSize: pdfMode ? 9 : 11,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    textAlign: 'right' as const,
    whiteSpace: 'nowrap',
  }

  const tdBase: React.CSSProperties = {
    padding: pdfMode ? '4px 8px' : '6px 10px',
    fontSize: pdfMode ? 9 : 11,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── KPIs resumen ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Capital final (M60)', value: fmtCLP(capitalFinal), color: 'var(--color-gold)' },
          { label: 'Ganancia acumulada', value: fmtCLP(gananciaTotal), color: '#10b981' },
          { label: 'Rentabilidad total', value: `${rentTotalPct.toFixed(1)}%`, color: '#60a5fa' },
          { label: 'Mes entrega / IVA', value: `M${mesEntrega} / M${mesIVA}`, color: '#d4a843' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: pdfMode ? 8 : 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: pdfMode ? 11 : 14, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Leyenda de colores ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10 }}>
        {[
          { color: COLOR_MES_ENTREGA, label: `🔑 Mes entrega (M${mesEntrega})` },
          { color: COLOR_MES_IVA, label: `💰 Dev. IVA (M${mesIVA})` },
          { color: COLOR_PRE_ENTREGA, label: '📋 Pre-entrega (pago pie)' },
          { color: COLOR_POST_ENTREGA, label: '🏠 Post-entrega (arriendo)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: '1px solid rgba(255,255,255,0.15)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Tabla mes a mes ── */}
      <div style={{ overflowX: 'auto', maxHeight: pdfMode ? 'none' : 480 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 22 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead>
            <tr>
              {['Mes', '', 'Capital inicio', 'Ahorro', 'Rentab.', 'Egreso pie', 'Dev. IVA', 'Capital fin', 'Gan. acum.'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.map((f) => {
              const isEntrega = f.mes === mesEntrega
              const isIVA = f.mes === mesIVA
              const isCierreAno = f.mes % 12 === 0

              return (
                <tr key={f.mes} style={rowStyle(f.mes, mesEntrega, mesIVA)}>
                  <td style={{ ...tdBase, fontWeight: (isEntrega || isIVA || isCierreAno) ? 700 : 400, color: isEntrega ? '#d4a843' : isIVA ? '#10b981' : 'inherit', textAlign: 'center' }}>
                    {f.mes}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'center', fontSize: 12 }}>
                    {rowIcon(f.mes, mesEntrega, mesIVA)}
                  </td>
                  <td style={tdBase}>{fmtCLP(f.capital_inicio)}</td>
                  <td style={{ ...tdBase, color: 'var(--color-success)' }}>+{fmtCLP(f.ahorro_mensual)}</td>
                  <td style={{ ...tdBase, color: '#60a5fa' }}>+{fmtCLP(f.rentabilizacion)}</td>
                  <td style={{ ...tdBase, color: f.egreso_cuotas > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                    {f.egreso_cuotas > 0 ? `-${fmtCLP(f.egreso_cuotas)}` : '—'}
                  </td>
                  <td style={{ ...tdBase, color: '#10b981', fontWeight: f.iva_inyeccion > 0 ? 700 : 400 }}>
                    {f.iva_inyeccion > 0 ? `+${fmtCLP(f.iva_inyeccion)}` : '—'}
                  </td>
                  <td style={{ ...tdBase, fontWeight: (isCierreAno || isEntrega) ? 700 : 500, color: f.capital_fin >= 0 ? 'var(--color-gold)' : 'var(--color-error)' }}>
                    {fmtCLP(f.capital_fin)}
                  </td>
                  <td style={{ ...tdBase, color: f.ganancia_acumulada >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {f.ganancia_acumulada >= 0 ? '+' : ''}{fmtCLP(f.ganancia_acumulada)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Resumen Anual ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Resumen anual
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Año', 'Capital al cierre', 'Ahorro acum.', 'Rentabiliz. acum.', 'Egreso acum.', 'Dev. IVA'].map((h) => (
                <th key={h} style={{ ...thStyle, position: undefined, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumenAnual.map((a) => (
              <tr key={a.ano} style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ ...tdBase, fontWeight: 700, color: 'var(--color-gold)', textAlign: 'center' }}>Año {a.ano}</td>
                <td style={{ ...tdBase, fontWeight: 700, color: 'var(--color-gold)' }}>{fmtCLP(a.capitalFin)}</td>
                <td style={{ ...tdBase, color: 'var(--color-success)' }}>+{fmtCLP(a.ahorroAcum)}</td>
                <td style={{ ...tdBase, color: '#60a5fa' }}>+{fmtCLP(a.rentAcum)}</td>
                <td style={{ ...tdBase, color: 'var(--color-warning)' }}>{a.egresoAcum > 0 ? `-${fmtCLP(a.egresoAcum)}` : '—'}</td>
                <td style={{ ...tdBase, color: a.ivaAcum > 0 ? '#10b981' : 'var(--color-text-muted)', fontWeight: a.ivaAcum > 0 ? 700 : 400 }}>
                  {a.ivaAcum > 0 ? `+${fmtCLP(a.ivaAcum)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
