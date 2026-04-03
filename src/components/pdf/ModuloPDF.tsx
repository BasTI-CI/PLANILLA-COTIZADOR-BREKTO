import { useState, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import { calcularDiversificacion } from '@/lib/engines/calculosDiversificacion'
import TablaCashflow60m from '@/components/flujo/TablaCashflow60m'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const fmtUF = (v: number) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`
const fmtCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const SECCIONES = [
  { id: 'portada',     label: 'Portada Corporativa',       icon: '🏢' },
  { id: 'cotA',        label: 'Cotización A',               icon: '🏠' },
  { id: 'cotB',        label: 'Cotización B',               icon: '🏠' },
  { id: 'cotC',        label: 'Cotización C',               icon: '🏠' },
  { id: 'cotD',        label: 'Cotización D',               icon: '🏠' },
  { id: 'resumen',     label: 'Resumen de Inversión',       icon: '📊' },
  { id: 'flujo',       label: 'Diversificación 60m',        icon: '💰' },
]

export default function ModuloPDF() {
  const { cotizaciones, global, diversificacion } = useAppStore()
  const uf = global.uf_valor_clp
  const [secciones, setSecciones] = useState<Set<string>>(
    new Set(['portada', 'cotA', 'resumen', 'flujo'])
  )
  const [generando, setGenerando] = useState(false)
  const [asesor, setAsesor] = useState('Asesor Brekto')
  const previewRef = useRef<HTMLDivElement>(null)

  const toggleSeccion = (id: string) =>
    setSecciones((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const activas = cotizaciones.filter((c) => c.activa)
  const letras = ['A', 'B', 'C', 'D']

  const generarPDF = async () => {
    if (!previewRef.current) return
    setGenerando(true)
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2, backgroundColor: '#0a0e1a', useCORS: true, logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height * pdfW) / canvas.width
      const pageH = pdf.internal.pageSize.getHeight()
      let yOffset = 0
      while (yOffset < pdfH) {
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfW, pdfH)
        yOffset += pageH
      }
      const nombre = global.inversionista_nombre.replace(/\s+/g, '_') || 'Cliente'
      const fecha = new Date().toLocaleDateString('es-CL').replace(/\//g, '-')
      pdf.save(`Propuesta_Brekto_${nombre}_${fecha}.pdf`)
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

      {/* ── Panel configuración ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">👤 Datos del Documento</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Asesor comercial</label>
              <input className="form-input" value={asesor} onChange={(e) => setAsesor(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Inversionista</label>
              <input className="form-input" value={global.inversionista_nombre} readOnly style={{ opacity: 0.7 }} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Secciones a Incluir</h3>
          </div>
          <div className="pdf-sections-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {SECCIONES.map((s) => {
              const idx = letras.indexOf(s.id.replace('cot', ''))
              const disponible = s.id === 'portada' || s.id === 'resumen' || s.id === 'flujo'
                || (idx >= 0 && cotizaciones[idx]?.activa)
              if (!disponible) return null
              return (
                <div
                  key={s.id}
                  className={`pdf-section-item ${secciones.has(s.id) ? 'checked' : ''}`}
                  onClick={() => toggleSeccion(s.id)}
                >
                  <div className="pdf-check-icon">{secciones.has(s.id) ? '✓' : ''}</div>
                  <span className="pdf-section-label">{s.icon} {s.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <button
          className="btn btn-gold btn-lg"
          onClick={generarPDF}
          disabled={generando || activas.length === 0}
          style={{ width: '100%' }}
        >
          {generando ? <><div className="loading-spinner" style={{ borderTopColor: '#0a0e1a' }} />Generando PDF...</> : <>📄 Exportar PDF</>}
        </button>
        {activas.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Completa al menos una cotización para activar la exportación.
          </p>
        )}
      </div>

      {/* ── Vista previa ── */}
      <div ref={previewRef} style={{
        background: '#0f1628',
        border: '1px solid rgba(212,168,67,0.2)',
        borderRadius: 12, overflow: 'hidden',
        fontFamily: 'Inter, sans-serif', minHeight: 600,
      }}>

        {/* Portada */}
        {secciones.has('portada') && (
          <div style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #1a2238 100%)', padding: '48px 40px', borderBottom: '2px solid rgba(212,168,67,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
              <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #d4a843, #f0c96a)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#0a0e1a', fontFamily: 'Outfit, sans-serif' }}>B</div>
              <div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 22, color: '#f1f5f9' }}><span style={{ color: '#d4a843' }}>Brekto</span> Inversiones</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Propuesta de Inversión Inmobiliaria</div>
              </div>
            </div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 28, color: '#f1f5f9', marginBottom: 8 }}>
              Propuesta de Inversión<br /><span style={{ color: '#d4a843' }}>Inmobiliaria</span>
            </h1>
            {global.inversionista_nombre && (
              <p style={{ fontSize: 15, color: '#94a3b8', marginBottom: 4 }}>
                Preparado para: <strong style={{ color: '#f1f5f9' }}>{global.inversionista_nombre}</strong>
                {global.inversionista_rut && <span style={{ color: '#64748b' }}> · {global.inversionista_rut}</span>}
              </p>
            )}
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 24 }}>
              {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              &nbsp;&nbsp;·&nbsp;&nbsp;UF {uf.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
              {asesor && <>&nbsp;&nbsp;·&nbsp;&nbsp;Asesor: {asesor}</>}
            </p>
          </div>
        )}

        {/* Cotizaciones individuales */}
        {activas.map((c) => {
          const letra = letras[c.id]
          if (!secciones.has(`cot${letra}`)) return null
          const r = calcularResultadosCotizacion(c, uf)
          return (
            <div key={c.id} style={{ padding: '32px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ background: '#d4a843', color: '#0a0e1a', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                  COTIZACIÓN {letra}
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', fontFamily: 'Outfit, sans-serif' }}>{c.propiedad.proyecto_nombre}</span>
                <span style={{ color: '#64748b', fontSize: 13 }}>· {c.propiedad.proyecto_comuna}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { l: 'Unidad', v: c.propiedad.unidad_numero },
                  { l: 'Tipología', v: c.propiedad.unidad_tipologia },
                  { l: 'Superficie total', v: `${c.propiedad.unidad_sup_total_m2} m²` },
                  { l: 'Precio neto', v: fmtUF(c.propiedad.precio_neto_uf) },
                  { l: 'Bono descuento (UF)', v: fmtUF(r.beneficio_inmobiliario_uf) },
                  { l: 'Valor escrituración (UF)', v: fmtUF(r.escrituracion_uf) },
                  { l: 'Pie total', v: `${(c.pie.pie_pct * 100).toFixed(0)}% — ${fmtUF(r.pie_total_uf)}` },
                  { l: 'Dividendo mensual', v: fmtUF(r.hipotecario.dividendo_total_uf) },
                  { l: 'Entrega', v: c.propiedad.unidad_entrega },
                ].map(({ l, v }) => (
                  <div key={l} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Resumen */}
        {secciones.has('resumen') && activas.length > 0 && (
          <div style={{ padding: '32px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#d4a843' }}>📊 Resumen de Inversión</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {activas.map((c) => {
                const r = calcularResultadosCotizacion(c, uf)
                return (
                  <div key={c.id} style={{ padding: 14, background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: '#d4a843', marginBottom: 8, fontWeight: 700 }}>Cotización {letras[c.id]}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{fmtUF(c.propiedad.precio_neto_uf)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtCLP(c.propiedad.precio_neto_uf * uf)}</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>Dividendo: <strong style={{ color: '#f1f5f9' }}>{fmtUF(r.hipotecario.dividendo_total_uf)}</strong></div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Cap Rate: <strong style={{ color: '#10b981' }}>{(r.arriendo.cap_rate_anual_pct * 100).toFixed(2)}%</strong></div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Flujo 60 meses */}
        {secciones.has('flujo') && activas.length > 0 && (() => {
          const tabla60 = calcularDiversificacion(diversificacion, cotizaciones, uf)
          return tabla60.length > 0 ? (
            <div style={{ padding: '32px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#d4a843' }}>
                💰 Proyección Flujo de Caja — 60 Meses
              </h2>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>
                La siguiente tabla muestra la proyección de diversificación de capital a 60 meses.
                Las cotizaciones activas generan egresos durante el período de pie (pre-entrega)
                y flujo de arriendo neto (post-entrega). El IVA es devuelto en el mes indicado.
              </p>
              <TablaCashflow60m
                tabla={tabla60}
                mesEntrega={diversificacion.mes_entrega_primer_depto}
                mesIVA={diversificacion.mes_entrega_primer_depto + 1}
                pdfMode
              />
            </div>
          ) : null
        })()}

        {/* Pie del PDF */}
        <div style={{ padding: '20px 40px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(212,168,67,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#64748b' }}><span style={{ color: '#d4a843', fontWeight: 700 }}>Brekto Inversiones</span> · Cotizador Inmobiliario</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{new Date().toLocaleDateString('es-CL')} · Uso confidencial</span>
        </div>
      </div>
    </div>
  )
}
