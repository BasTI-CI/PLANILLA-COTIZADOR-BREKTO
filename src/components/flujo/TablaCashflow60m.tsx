import type { FilaDiversificacion } from '@/types'

interface ResumenFlujoContexto {
  capitalInicialClp: number
  tasaMensualDecimal: number
  gastosOperacionalesClp: number
  amobladoOtrosClp: number
  ahorroMensualClp: number
  ivaTotalReferenciaClp: number
}

interface Props {
  tabla: FilaDiversificacion[]
  /** Meses absolutos con al menos una entrega de departamento */
  mesesEntrega: number[]
  /** Meses con inyección de devolución IVA (por unidad) */
  mesesIVA: number[]
  resumenContexto?: ResumenFlujoContexto
  /** true = versión compacta para PDF (sin sticky header, sin interactividad) */
  pdfMode?: boolean
  /** Paleta clara para PDF en fondo blanco (usar con pdfMode) */
  pdfLight?: boolean
  /** true = sólo resumen anual (sin tabla mes a mes) */
  annualOnly?: boolean
}

const fmtCLP = (v: number) =>
  `$${Math.round(Math.abs(v)).toLocaleString('es-CL')}${v < 0 ? ' ▼' : ''}`

// ─── Colores de hito ───────────────────────────────────────────────
const COLOR_PRE_ENTREGA = 'rgba(59,130,246,0.07)'
const COLOR_POST_ENTREGA = 'rgba(16,185,129,0.07)'
const COLOR_MIXED = 'rgba(148,163,184,0.06)'
const COLOR_MES_ENTREGA = 'rgba(212,168,67,0.22)'
const COLOR_MES_IVA = 'rgba(16,185,129,0.22)'
const COLOR_CIERRE_ANO = 'rgba(255,255,255,0.06)'
const BORDER_CIERRE_ANO = '2px solid rgba(255,255,255,0.18)'

const LIGHT = {
  entrega: 'rgba(251,191,36,0.28)',
  iva: 'rgba(16,185,129,0.22)',
  mix: 'rgba(148,163,184,0.12)',
  pre: 'rgba(59,130,246,0.1)',
  post: 'rgba(16,185,129,0.1)',
  cierre: 'rgba(241,245,249,0.95)',
  borderCierre: '2px solid #cbd5e1',
}

function rowStyle(
  mes: number,
  mesesEntrega: number[],
  mesesIVA: number[],
  light: boolean
): React.CSSProperties {
  if (light) {
    if (mesesEntrega.includes(mes)) return { background: LIGHT.entrega }
    if (mesesIVA.includes(mes)) return { background: LIGHT.iva }
    if (mes % 12 === 0) return { background: LIGHT.cierre, borderBottom: LIGHT.borderCierre }
    const minE = mesesEntrega.length ? Math.min(...mesesEntrega) : 1
    const maxE = mesesEntrega.length ? Math.max(...mesesEntrega) : 60
    if (mes < minE) return { background: LIGHT.pre }
    if (mes > maxE) return { background: LIGHT.post }
    return { background: LIGHT.mix }
  }
  if (mesesEntrega.includes(mes)) return { background: COLOR_MES_ENTREGA }
  if (mesesIVA.includes(mes)) return { background: COLOR_MES_IVA }
  if (mes % 12 === 0) return { background: COLOR_CIERRE_ANO, borderBottom: BORDER_CIERRE_ANO }
  const minE = mesesEntrega.length ? Math.min(...mesesEntrega) : 1
  const maxE = mesesEntrega.length ? Math.max(...mesesEntrega) : 60
  if (mes < minE) return { background: COLOR_PRE_ENTREGA }
  if (mes > maxE) return { background: COLOR_POST_ENTREGA }
  return { background: COLOR_MIXED }
}

function rowIcon(mes: number, mesesEntrega: number[], mesesIVA: number[]): string {
  if (mesesEntrega.includes(mes)) return '🔑'
  if (mesesIVA.includes(mes)) return '💰'
  if (mes % 12 === 0) return '📅'
  return ''
}

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

function totales60Meses(tabla: FilaDiversificacion[]) {
  return {
    capitalFin: tabla[59]?.capital_fin ?? 0,
    ahorroAcum: tabla.reduce((s, f) => s + f.ahorro_mensual, 0),
    rentAcum: tabla.reduce((s, f) => s + f.rentabilizacion, 0),
    egresoAcum: tabla.reduce((s, f) => s + f.egreso_cuotas, 0),
    ivaAcum: tabla.reduce((s, f) => s + f.iva_inyeccion, 0),
    gananciaAcum: tabla[59]?.ganancia_acumulada ?? 0,
  }
}

export default function TablaCashflow60m({
  tabla,
  mesesEntrega,
  mesesIVA,
  resumenContexto,
  pdfMode = false,
  pdfLight = false,
  annualOnly = false,
}: Props) {
  if (tabla.length === 0) return null

  const light = pdfMode && pdfLight

  const resumenAnual = resumenesAnuales(tabla)
  const t60 = totales60Meses(tabla)
  const capitalFinal = tabla[59]?.capital_fin ?? 0
  const capitalInicial = tabla[0]?.capital_inicio ?? 0
  const gananciaTotal = tabla[59]?.ganancia_acumulada ?? 0
  const rentTotalPct = capitalInicial > 0 ? (gananciaTotal / capitalInicial) * 100 : 0

  const hitosEntregaTxt =
    mesesEntrega.length === 0
      ? '—'
      : mesesEntrega.length <= 3
        ? mesesEntrega.map((m) => `M${m}`).join(', ')
        : `${mesesEntrega.length} meses (${mesesEntrega.map((m) => `M${m}`).join(', ')})`

  const hitosIvaTxt =
    mesesIVA.length === 0
      ? '—'
      : mesesIVA.length <= 3
        ? mesesIVA.map((m) => `M${m}`).join(', ')
        : `${mesesIVA.length} meses`

  const thStyle: React.CSSProperties = {
    position: pdfMode ? undefined : 'sticky',
    top: pdfMode ? undefined : 0,
    background: light ? '#e2e8f0' : '#0f1628',
    zIndex: 10,
    padding: '8px 10px',
    fontSize: pdfMode ? 9 : 11,
    fontWeight: 700,
    color: light ? '#334155' : 'var(--color-text-muted)',
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
    borderBottom: light ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.04)',
    color: light ? '#0f172a' : undefined,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {!annualOnly && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { label: 'Capital final (M60)', value: fmtCLP(capitalFinal), color: 'var(--color-gold)' },
            { label: 'Ganancia acumulada', value: fmtCLP(gananciaTotal), color: '#10b981' },
            { label: 'Rentabilidad total', value: `${rentTotalPct.toFixed(1)}%`, color: '#60a5fa' },
            { label: 'Entregas / Dev. IVA', value: `${hitosEntregaTxt} · ${hitosIvaTxt}`, color: '#d4a843' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '8px 12px', background: light ? '#f8fafc' : 'rgba(255,255,255,0.03)', borderRadius: 8, border: light ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: pdfMode ? 8 : 10, color: light ? '#64748b' : 'var(--color-text-muted)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: pdfMode ? 10 : 13, fontWeight: 700, color, lineHeight: 1.25 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {!annualOnly && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10 }}>
        {[
          { color: light ? LIGHT.entrega : COLOR_MES_ENTREGA, label: '🔑 Mes(es) entrega' },
          { color: light ? LIGHT.iva : COLOR_MES_IVA, label: '💰 Dev. IVA (M entrega + 5)' },
          { color: light ? LIGHT.pre : COLOR_PRE_ENTREGA, label: '📋 Pre entrega (pie)' },
          { color: light ? LIGHT.mix : COLOR_MIXED, label: '🔀 Fase mixta' },
          { color: light ? LIGHT.post : COLOR_POST_ENTREGA, label: '🏠 Post entrega' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: light ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)' }} />
            <span style={{ color: light ? '#475569' : 'var(--color-text-muted)' }}>{label}</span>
          </div>
        ))}
        </div>
      )}

      {!annualOnly && (
        <p
        style={{
          fontSize: pdfMode ? 8 : 11,
          color: light ? '#475569' : 'var(--color-text-muted)',
          lineHeight: 1.45,
          margin: 0,
          maxWidth: 920,
        }}
      >
        <strong style={{ color: 'var(--color-text-secondary)' }}>Ganancia acumulada</strong> (penúltima columna){' '}
        es cada mes <strong>capital final del mes − capital inicial nominal</strong> (el monto que ingresaste en «Capital inicial», sin restar gastos de escrituración). La <strong>última columna</strong> es el <strong>capital al cierre</strong> de ese mes.
        Por eso los primeros meses suelen verse <strong style={{ color: 'var(--color-error)' }}>en rojo</strong>: al inicio se descuentan gastos operacionales y amoblado del efectivo, y siguen los egresos de pie; el saldo queda por debajo del capital inicial «en papel» hasta que lo recuperan ahorro, rentabilidad e inyecciones (p. ej. IVA).
        </p>
      )}

      {!annualOnly && (
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
            <col style={{ width: 88 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr>
              {[
                'Mes',
                '',
                'Capital inicio',
                'Ahorro',
                'Rentab.',
                'Egresos',
                'Dev. IVA',
                'Gan. acum.',
                'Capital fin',
              ].map((h) => (
                <th
                  key={h}
                  style={thStyle}
                  title={
                    h === 'Gan. acum.'
                      ? 'Capital final del mes menos capital inicial nominal (puede ser negativo al inicio si hay gastos de escrituración y egresos de pie).'
                      : h === 'Capital fin'
                        ? 'Saldo al cierre del mes tras ahorro, egresos, IVA y rentabilización.'
                        : undefined
                  }
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.map((f) => {
              const isEntrega = mesesEntrega.includes(f.mes)
              const isIVA = mesesIVA.includes(f.mes)
              const isCierreAno = f.mes % 12 === 0

              return (
                <tr key={f.mes} style={rowStyle(f.mes, mesesEntrega, mesesIVA, light)}>
                  <td style={{ ...tdBase, fontWeight: (isEntrega || isIVA || isCierreAno) ? 700 : 400, color: isEntrega ? (light ? '#b45309' : '#d4a843') : isIVA ? '#059669' : 'inherit', textAlign: 'center' }}>
                    {f.mes}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'center', fontSize: 12 }}>
                    {rowIcon(f.mes, mesesEntrega, mesesIVA)}
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
                  <td style={{ ...tdBase, color: f.ganancia_acumulada >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {f.ganancia_acumulada >= 0 ? '+' : ''}{fmtCLP(f.ganancia_acumulada)}
                  </td>
                  <td style={{ ...tdBase, fontWeight: (isCierreAno || isEntrega) ? 700 : 500, color: f.capital_fin >= 0 ? 'var(--color-gold)' : 'var(--color-error)' }}>
                    {fmtCLP(f.capital_fin)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}

      {/* ── Resumen Anual ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: light ? '#64748b' : 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Resumen anual
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Año', 'Capital al cierre', 'Ahorro acum.', 'Rentabiliz. acum.', 'Egreso acum.', 'Dev. IVA'].map((h) => (
                <th key={h} style={{ ...thStyle, position: undefined, background: light ? '#f1f5f9' : 'rgba(255,255,255,0.04)', borderRadius: 4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumenAnual.map((a) => (
              <tr key={a.ano} style={{ background: light ? '#f8fafc' : 'rgba(255,255,255,0.02)', borderBottom: light ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ ...tdBase, fontWeight: 700, color: light ? '#b45309' : 'var(--color-gold)', textAlign: 'center' }}>Año {a.ano}</td>
                <td style={{ ...tdBase, fontWeight: 700, color: light ? '#b45309' : 'var(--color-gold)' }}>{fmtCLP(a.capitalFin)}</td>
                <td style={{ ...tdBase, color: 'var(--color-success)' }}>+{fmtCLP(a.ahorroAcum)}</td>
                <td style={{ ...tdBase, color: '#60a5fa' }}>+{fmtCLP(a.rentAcum)}</td>
                <td style={{ ...tdBase, color: 'var(--color-warning)' }}>{a.egresoAcum > 0 ? `-${fmtCLP(a.egresoAcum)}` : '—'}</td>
                <td style={{ ...tdBase, color: a.ivaAcum > 0 ? '#10b981' : 'var(--color-text-muted)', fontWeight: a.ivaAcum > 0 ? 700 : 400 }}>
                  {a.ivaAcum > 0 ? `+${fmtCLP(a.ivaAcum)}` : '—'}
                </td>
              </tr>
            ))}
            <tr style={{ background: light ? 'rgba(251,191,36,0.15)' : 'rgba(212,168,67,0.12)', borderTop: light ? '2px solid #fbbf24' : '2px solid rgba(212,168,67,0.35)' }}>
              <td style={{ ...tdBase, fontWeight: 800, color: light ? '#92400e' : 'var(--color-gold)', textAlign: 'center', fontSize: 12 }}>RESUMEN TOTAL (60 m.)</td>
              <td style={{ ...tdBase, fontWeight: 800, color: light ? '#92400e' : 'var(--color-gold)' }}>{fmtCLP(t60.capitalFin)}</td>
              <td style={{ ...tdBase, fontWeight: 700, color: 'var(--color-success)' }}>+{fmtCLP(t60.ahorroAcum)}</td>
              <td style={{ ...tdBase, fontWeight: 700, color: '#60a5fa' }}>+{fmtCLP(t60.rentAcum)}</td>
              <td style={{ ...tdBase, fontWeight: 700, color: 'var(--color-warning)' }}>{t60.egresoAcum > 0 ? `-${fmtCLP(t60.egresoAcum)}` : '—'}</td>
              <td style={{ ...tdBase, fontWeight: 700, color: '#10b981' }}>{t60.ivaAcum > 0 ? `+${fmtCLP(t60.ivaAcum)}` : '—'}</td>
            </tr>
          </tbody>
        </table>
        {resumenContexto && (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              background: light ? '#f8fafc' : 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: light ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
              fontSize: pdfMode ? 9 : 11,
              lineHeight: 1.55,
              color: light ? '#334155' : 'var(--color-text-secondary)',
            }}
          >
            <div style={{ fontWeight: 700, color: light ? '#b45309' : 'var(--color-gold)', marginBottom: 6, fontSize: pdfMode ? 10 : 12 }}>
              Variables del modelo (entrada al cálculo financiero)
            </div>
            <span>Capital inicial considerado: <strong style={{ color: 'var(--color-text-primary)' }}>{fmtCLP(resumenContexto.capitalInicialClp)}</strong></span>
            {' · '}
            <span>Tasa rentabilidad mensual: <strong style={{ color: 'var(--color-text-primary)' }}>{(resumenContexto.tasaMensualDecimal * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></span>
            {' · '}
            <span>Gastos operacionales (escrituración): <strong style={{ color: 'var(--color-text-primary)' }}>{fmtCLP(resumenContexto.gastosOperacionalesClp)}</strong></span>
            {' · '}
            <span>Amoblado y otros: <strong style={{ color: 'var(--color-text-primary)' }}>{fmtCLP(resumenContexto.amobladoOtrosClp)}</strong></span>
            {' · '}
            <span>Ahorro mensual (nominal): <strong style={{ color: 'var(--color-text-primary)' }}>{fmtCLP(resumenContexto.ahorroMensualClp)}/mes</strong></span>
            {' · '}
            <span>Devolución IVA de referencia (total): <strong style={{ color: 'var(--color-text-primary)' }}>{fmtCLP(resumenContexto.ivaTotalReferenciaClp)}</strong></span>
            {' · '}
            <span>Ganancia acumulada (M60): <strong style={{ color: t60.gananciaAcum >= 0 ? '#10b981' : 'var(--color-error)' }}>{t60.gananciaAcum >= 0 ? '+' : ''}{fmtCLP(t60.gananciaAcum)}</strong></span>
          </div>
        )}
      </div>
    </div>
  )
}
