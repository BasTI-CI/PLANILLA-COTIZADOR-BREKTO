import { useState, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import { calcularDiversificacion, calcularIvaTotal } from '@/lib/engines/calculosDiversificacion'
import { calcularMontosDesglosePieClp } from '@/lib/engines/calculosPie'
import { bonoPieUf, pieAPagarUf } from '@/lib/engines/desglosePieUf'
import { precioCompraDeptoUf } from '@/lib/engines/precioCompra'
import TablaCashflow60m from '@/components/flujo/TablaCashflow60m'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { PromocionesCotizacion } from '@/types'
import { DEFAULT_PROMOCIONES } from '@/types'

const fmtUF = (v: number) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`
const fmtCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

/** Colores para documento impreso (fondo blanco). */
const T = {
  bg: '#ffffff',
  card: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  gold: '#b45309',
  accent: '#1e3a5f',
}

const PROMO_LABELS: [keyof PromocionesCotizacion, string][] = [
  ['arriendo_garantizado', 'Arriendo garantizado'],
  ['kit_arriendo', 'Kit de arriendo'],
  ['kit_inversionista', 'Kit de inversionista'],
  ['credito_pie_institucion', 'Crédito pie con institución financiera'],
  ['bono_amoblado', 'Bono amoblado'],
  ['credito_aval', 'Crédito aval'],
  ['promo_gastos_operacionales', 'Promoción gastos operacionales'],
  ['comentario_devolucion_iva', 'Comentario: "Cliente hará devolución de IVA"'],
]

function leyendaPromociones(p: PromocionesCotizacion | undefined): string[] {
  const base = { ...DEFAULT_PROMOCIONES, ...p }
  return PROMO_LABELS.filter(([k]) => base[k]).map(([, label]) => label)
}

const SECCIONES = [
  { id: 'portada', label: 'Portada Corporativa', icon: '🏢' },
  { id: 'cotA', label: 'Cotización A', icon: '🏠' },
  { id: 'cotB', label: 'Cotización B', icon: '🏠' },
  { id: 'cotC', label: 'Cotización C', icon: '🏠' },
  { id: 'cotD', label: 'Cotización D', icon: '🏠' },
  { id: 'resumen', label: 'Resumen de Inversión', icon: '📊' },
  { id: 'flujo', label: 'Diversificación 60m', icon: '💰' },
]

const MAX_PDF_BYTES = 10 * 1024 * 1024

export default function ModuloPDF() {
  const { cotizaciones, global, diversificacion } = useAppStore()
  const uf = global.uf_valor_clp
  const [secciones, setSecciones] = useState<Set<string>>(
    new Set(['portada', 'cotA', 'resumen', 'flujo'])
  )
  const [anexoTabla60m, setAnexoTabla60m] = useState(false)
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
        scale: 1.65,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      })

      let quality = 0.9
      let lastPdf: jsPDF | null = null
      let lastSize = 0

      for (let attempt = 0; attempt < 14; attempt++) {
        const imgData = canvas.toDataURL('image/jpeg', quality)
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
        const pw = pdf.internal.pageSize.getWidth()
        const ph = pdf.internal.pageSize.getHeight()
        const imgH = (canvas.height * pw) / canvas.width
        let yOffset = 0
        while (yOffset < imgH) {
          if (yOffset > 0) pdf.addPage()
          pdf.addImage(imgData, 'JPEG', 0, -yOffset, pw, imgH)
          yOffset += ph
        }
        const blob = pdf.output('blob')
        lastPdf = pdf
        lastSize = blob.size
        if (blob.size <= MAX_PDF_BYTES || quality <= 0.48) break
        quality -= 0.045
      }

      const nombre = global.inversionista_nombre.replace(/\s+/g, '_') || 'Cliente'
      const fecha = new Date().toLocaleDateString('es-CL').replace(/\//g, '-')
      lastPdf?.save(`Propuesta_Brekto_${nombre}_${fecha}.pdf`)

      if (lastSize > MAX_PDF_BYTES) {
        window.alert(
          `El PDF generado pesa aprox. ${(lastSize / (1024 * 1024)).toFixed(1)} MB (recomendado ≤ 10 MB para envío por correo). ` +
            'Prueba desmarcar secciones o bajar la calidad desde el navegador (imprimir → Más ajustes).'
        )
      }
    } finally {
      setGenerando(false)
    }
  }

  // ----- Helpers visuales locales (PDF) -----
  const subTitleStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    color: T.gold,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: 14,
    marginBottom: 6,
  }
  const SubTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={subTitleStyle}>{children}</div>
  )
  const StatBox = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div style={{ padding: '7px 10px', background: T.card, borderRadius: 6, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.muted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, lineHeight: 1.25 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  )
  const Grid = ({ cols, children }: { cols: number; children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>{children}</div>
  )

  const renderCotizacionBloque = (c: (typeof cotizaciones)[0], letra: string, r: ReturnType<typeof calcularResultadosCotizacion>) => {
    const propiedad = c.propiedad
    const pie = c.pie
    const hip = c.hipotecario
    const rent = c.rentabilidad
    const pcDeptoUf = precioCompraDeptoUf(propiedad)
    const descuentoTotalUf = propiedad.descuento_uf
    const beneficioUf = r.beneficio_inmobiliario_uf
    const bonoPie = bonoPieUf(r.valor_escritura_uf, pie)
    const piePagar = pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, pie)
    const pctRestoBonoPie =
      pie.pie_pct - pie.upfront_pct - pie.cuotas_antes_entrega_pct - pie.cuotas_despues_entrega_pct - pie.cuoton_pct
    const desg = calcularMontosDesglosePieClp(r.valor_escritura_uf, pie, uf)
    const tieneEst = propiedad.estacionamiento_uf > 0
    const tieneBod = propiedad.bodega_uf > 0
    const renta = rent.tipo_renta
    const capRate = renta === 'corta' ? r.arriendo.airbnb_cap_rate_anual_pct : r.arriendo.cap_rate_anual_pct

    return (
      <div
        key={`cot-${letra}`}
        style={{ padding: '24px 36px', borderBottom: `1px solid ${T.border}`, background: T.bg }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ background: T.gold, color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
            COTIZACIÓN {letra}
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, fontFamily: 'Outfit, sans-serif' }}>
            {propiedad.proyecto_nombre}
          </span>
          <span style={{ color: T.muted, fontSize: 12 }}>· {propiedad.proyecto_comuna}</span>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>
          Unidad <strong style={{ color: T.text }}>{propiedad.unidad_numero}</strong>
          {' · '}{propiedad.unidad_tipologia}
          {' · '}{propiedad.unidad_sup_total_m2} m²
          {' · '}Entrega: {propiedad.unidad_entrega}
        </div>

        {/* I.a Detalle de precios y descuentos */}
        <SubTitle>I.a · Detalle de precios y descuentos</SubTitle>
        <Grid cols={3}>
          <StatBox label="Precio lista" value={fmtUF(propiedad.precio_lista_uf)} sub={fmtCLP(propiedad.precio_lista_uf * uf)} />
          <StatBox label="Descuento total" value={fmtUF(descuentoTotalUf)} sub={fmtCLP(descuentoTotalUf * uf)} />
          <StatBox label="Descuento por bono (BI)" value={fmtUF(beneficioUf)} sub={fmtCLP(beneficioUf * uf)} />
          <StatBox label="Precio de compra depto" value={fmtUF(pcDeptoUf)} sub={fmtCLP(pcDeptoUf * uf)} />
          {tieneEst && (
            <StatBox label="Estacionamiento" value={fmtUF(propiedad.estacionamiento_uf)} sub={fmtCLP(propiedad.estacionamiento_uf * uf)} />
          )}
          {tieneBod && (
            <StatBox label="Bodega" value={fmtUF(propiedad.bodega_uf)} sub={fmtCLP(propiedad.bodega_uf * uf)} />
          )}
          <StatBox
            label="Bono pie"
            value={`${(pctRestoBonoPie * 100).toFixed(2)}% · ${fmtUF(bonoPie)}`}
            sub={fmtCLP(bonoPie * uf)}
          />
          <StatBox label="Precio de compra total" value={fmtUF(r.precio_compra_total_uf)} sub={fmtCLP(r.precio_compra_total_uf * uf)} />
          <StatBox label="Valor de escrituración" value={fmtUF(r.valor_escritura_uf)} sub={fmtCLP(r.valor_escritura_uf * uf)} />
        </Grid>

        {/* I.b Pie y forma de pago */}
        <SubTitle>I.b · Pie y forma de pago</SubTitle>
        <Grid cols={3}>
          <StatBox
            label="Pie a documentar"
            value={`${(pie.pie_pct * 100).toFixed(2)}% · ${fmtUF(r.pie_total_uf)}`}
            sub={fmtCLP(r.pie_total_clp)}
          />
          <StatBox label="Bono pie" value={fmtUF(bonoPie)} sub={fmtCLP(bonoPie * uf)} />
          <StatBox label="Pie a pagar" value={fmtUF(piePagar)} sub={fmtCLP(piePagar * uf)} />
          <StatBox label="Upfront" value={`${(pie.upfront_pct * 100).toFixed(2)}%`} sub={fmtCLP(desg.monto_upfront_clp)} />
          <StatBox
            label="% antes / N cuotas"
            value={`${(pie.cuotas_antes_entrega_pct * 100).toFixed(2)}% · ${pie.cuotas_antes_entrega_n}`}
            sub={`${fmtCLP(desg.monto_cuota_antes_clp)} / cuota`}
          />
          <StatBox
            label="% después / N cuotas"
            value={`${(pie.cuotas_despues_entrega_pct * 100).toFixed(2)}% · ${pie.cuotas_despues_entrega_n}`}
            sub={`${fmtCLP(desg.monto_cuota_despues_clp)} / cuota`}
          />
          <StatBox label="Cuotón %" value={`${(pie.cuoton_pct * 100).toFixed(2)}%`} />
          <StatBox
            label="Cuotas cuotón"
            value={`${pie.cuoton_n_cuotas}`}
            sub={`${fmtCLP(desg.monto_cuoton_clp)} / cuota`}
          />
          <StatBox label="Cuotas totales pie" value={`${pie.pie_n_cuotas_total}`} />
        </Grid>

        {/* I.c Resumen financiero */}
        <SubTitle>I.c · Resumen financiero</SubTitle>
        <Grid cols={3}>
          <StatBox label="Precio de compra total" value={fmtUF(r.precio_compra_total_uf)} sub={fmtCLP(r.precio_compra_total_uf * uf)} />
          <StatBox label="Valor de escrituración" value={fmtUF(r.valor_escritura_uf)} sub={fmtCLP(r.valor_escritura_uf * uf)} />
          <StatBox label="Pie a documentar" value={fmtUF(r.pie_total_uf)} sub={fmtCLP(r.pie_total_clp)} />
          <StatBox label="Bono pie" value={fmtUF(bonoPie)} sub={fmtCLP(bonoPie * uf)} />
          <StatBox label="Pie a pagar" value={fmtUF(piePagar)} sub={fmtCLP(piePagar * uf)} />
          <StatBox label="Monto crédito" value={fmtUF(r.hipotecario.monto_credito_uf)} sub={fmtCLP(r.hipotecario.monto_credito_clp)} />
        </Grid>

        {/* I.d Crédito sobre valor de escrituración */}
        <SubTitle>I.d · Crédito sobre valor de escrituración</SubTitle>
        <Grid cols={4}>
          <StatBox label="Monto crédito" value={fmtUF(r.hipotecario.monto_credito_uf)} sub={fmtCLP(r.hipotecario.monto_credito_clp)} />
          <StatBox label="Tasa anual" value={`${(hip.hipotecario_tasa_anual * 100).toFixed(2)}%`} />
          <StatBox label="Plazo" value={`${hip.hipotecario_plazo_anos} años`} />
          <StatBox label="Dividendo mensual" value={fmtUF(r.hipotecario.dividendo_total_uf)} sub={fmtCLP(r.hipotecario.dividendo_total_clp)} />
        </Grid>

        {/* I.e Rentabilidad */}
        <SubTitle>I.e · Rentabilidad</SubTitle>
        <Grid cols={3}>
          <StatBox
            label="Plusvalía anual"
            value={`${(rent.plusvalia_anual_pct * 100).toFixed(2)}%`}
            sub={`${rent.plusvalia_anos} años`}
          />
          <StatBox
            label="Precio venta proyectado"
            value={fmtUF(r.plusvalia.precio_venta_5anos_uf)}
            sub={fmtCLP(r.plusvalia.precio_venta_5anos_uf * uf)}
          />
          <StatBox
            label="Ganancia venta"
            value={fmtUF(r.plusvalia.ganancia_venta_uf)}
            sub={fmtCLP(r.plusvalia.ganancia_venta_clp)}
          />
          <StatBox label={renta === 'corta' ? 'Cap rate AirBnB anual' : 'Cap rate anual'} value={`${(capRate * 100).toFixed(2)}%`} />
          <StatBox
            label={renta === 'corta' ? 'Ingreso neto renta corta' : 'Arriendo neto mensual'}
            value={fmtCLP(r.arriendo.ingreso_neto_flujo_clp)}
          />
          <StatBox label="Resultado mensual (arr − div)" value={fmtCLP(r.arriendo.resultado_mensual_clp)} />
        </Grid>

        {/* I.f Resultado (mismo bloque del CotizacionForm) */}
        <SubTitle>I.f · Resultado</SubTitle>
        <Grid cols={4}>
          <StatBox label="Precio de compra total" value={fmtUF(r.precio_compra_total_uf)} sub={fmtCLP(r.precio_compra_total_uf * uf)} />
          <StatBox label="Valor tasación depto" value={fmtUF(r.valor_tasacion_uf)} sub={fmtCLP(r.valor_tasacion_uf * uf)} />
          <StatBox label="Valor escrituración" value={fmtUF(r.valor_escritura_uf)} sub={fmtCLP(r.valor_escritura_uf * uf)} />
          <StatBox label="Pie total" value={fmtUF(r.pie_total_uf)} sub={fmtCLP(r.pie_total_clp)} />
          <StatBox label="Monto crédito" value={fmtUF(r.hipotecario.monto_credito_uf)} sub={fmtCLP(r.hipotecario.monto_credito_clp)} />
          <StatBox label="Dividendo mensual" value={fmtUF(r.hipotecario.dividendo_total_uf)} sub={fmtCLP(r.hipotecario.dividendo_total_clp)} />
          <StatBox
            label={renta === 'corta' ? 'Ingreso neto renta corta' : 'Arriendo neto mensual'}
            value={fmtCLP(r.arriendo.ingreso_neto_flujo_clp)}
            sub={`vs div: ${fmtCLP(r.arriendo.resultado_mensual_clp)} / mes`}
          />
        </Grid>

        {/* I.g Promociones */}
        {leyendaPromociones(c.promociones).length > 0 && (
          <>
            <SubTitle>I.g · Promociones de la cotización</SubTitle>
            <ul style={{ margin: 0, paddingLeft: 18, color: T.text, fontSize: 12, lineHeight: 1.55 }}>
              {leyendaPromociones(c.promociones).map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
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
              const disponible =
                s.id === 'portada' || s.id === 'resumen' || s.id === 'flujo' || (idx >= 0 && cotizaciones[idx]?.activa)
              if (!disponible) return null
              return (
                <div
                  key={s.id}
                  className={`pdf-section-item ${secciones.has(s.id) ? 'checked' : ''}`}
                  onClick={() => toggleSeccion(s.id)}
                >
                  <div className="pdf-check-icon">{secciones.has(s.id) ? '✓' : ''}</div>
                  <span className="pdf-section-label">
                    {s.icon} {s.label}
                  </span>
                </div>
              )
            })}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1.45,
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={anexoTabla60m}
              onChange={(e) => setAnexoTabla60m(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>Anexo final: tabla completa de 60 meses</strong>
              <br />
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                Agrega al final del PDF la tabla mensual completa como anexo separado.
              </span>
            </span>
          </label>
        </div>

        <button
          className="btn btn-gold btn-lg"
          onClick={generarPDF}
          disabled={generando || activas.length === 0}
          style={{ width: '100%' }}
        >
          {generando ? (
            <>
              <div className="loading-spinner" style={{ borderTopColor: '#0a0e1a' }} />
              Generando PDF...
            </>
          ) : (
            <>📄 Exportar PDF</>
          )}
        </button>
        {activas.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Completa al menos una cotización para activar la exportación.
          </p>
        )}
      </div>

      <div
        ref={previewRef}
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
          minHeight: 600,
          color: T.text,
        }}
      >
        {secciones.has('portada') && (
          <div
            style={{
              background: T.bg,
              padding: '48px 40px',
              borderBottom: `2px solid ${T.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: `linear-gradient(135deg, ${T.gold}, #fbbf24)`,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                B
              </div>
              <div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 22, color: T.text }}>
                  <span style={{ color: T.gold }}>Brekto</span> Inversiones
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>Propuesta de Inversión Inmobiliaria</div>
              </div>
            </div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 28, color: T.text, marginBottom: 8 }}>
              Propuesta de Inversión
              <br />
              <span style={{ color: T.gold }}>Inmobiliaria</span>
            </h1>
            {global.inversionista_nombre && (
              <p style={{ fontSize: 15, color: T.muted, marginBottom: 4 }}>
                Preparado para: <strong style={{ color: T.text }}>{global.inversionista_nombre}</strong>
                {global.inversionista_rut && <span style={{ color: T.muted }}> · {global.inversionista_rut}</span>}
              </p>
            )}
            <p style={{ fontSize: 13, color: T.muted, marginTop: 24 }}>
              {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              &nbsp;&nbsp;·&nbsp;&nbsp;UF {uf.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
              {asesor && <>&nbsp;&nbsp;·&nbsp;&nbsp;Asesor: {asesor}</>}
            </p>
          </div>
        )}

        {activas.map((c) => {
          const letra = letras[c.id]
          if (!secciones.has(`cot${letra}`)) return null
          const r = calcularResultadosCotizacion(c, uf)
          return (
            <div key={`block-${letra}`}>
              {renderCotizacionBloque(c, letra, r)}
            </div>
          )
        })}

        {secciones.has('resumen') && activas.length > 0 && (
          <div style={{ padding: '32px 40px', borderBottom: `1px solid ${T.border}`, background: T.bg }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 16, color: T.gold }}>
              📊 Resumen de Inversión
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {activas.map((c) => {
                const r = calcularResultadosCotizacion(c, uf)
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: 14,
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, color: T.gold, marginBottom: 8, fontWeight: 700 }}>
                      Cotización {letras[c.id]}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                      {fmtUF(c.propiedad.precio_neto_uf)}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>{fmtCLP(c.propiedad.precio_neto_uf * uf)}</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>
                      Dividendo: <strong style={{ color: T.text }}>{fmtUF(r.hipotecario.dividendo_total_uf)}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      Cap Rate:{' '}
                      <strong style={{ color: '#059669' }}>{(r.arriendo.cap_rate_anual_pct * 100).toFixed(2)}%</strong>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {secciones.has('flujo') && activas.length > 0 && (() => {
          const tabla60 = calcularDiversificacion(diversificacion, cotizaciones, uf)
          return tabla60.length > 0 ? (
            <div style={{ padding: '32px 40px', borderBottom: `1px solid ${T.border}`, background: T.bg }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 16, color: T.gold }}>
                💰 Proyección Flujo de Caja — 60 Meses
              </h2>
              <p style={{ fontSize: 11, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>
                Para impresión se muestra el resumen anual consolidado. La tabla mensual completa de 60 meses se puede imprimir
                opcionalmente como anexo separado al final del PDF.
              </p>
              <TablaCashflow60m
                tabla={tabla60}
                mesesEntrega={[
                  ...new Set(activas.map((c) => c.mes_entrega_flujo).filter((m): m is number => m != null)),
                ].sort((a, b) => a - b)}
                mesesIVA={[
                  ...new Set(
                    activas
                      .filter((c) => c.califica_iva && c.mes_entrega_flujo != null)
                      .map((c) => (c.mes_entrega_flujo as number) + 5)
                      .filter((m) => m >= 1 && m <= 60)
                  ),
                ].sort((a, b) => a - b)}
                resumenContexto={{
                  capitalInicialClp: diversificacion.diversif_capital_inicial_clp,
                  tasaMensualDecimal: diversificacion.diversif_tasa_mensual,
                  gastosOperacionalesClp: diversificacion.diversif_gastos_operacionales_clp,
                  amobladoOtrosClp: diversificacion.diversif_amoblado_otros_clp,
                  ahorroMensualClp: diversificacion.diversif_ahorro_mensual_clp,
                  ivaTotalReferenciaClp: diversificacion.diversif_iva_manual_override
                    ? diversificacion.diversif_iva_total_clp
                    : calcularIvaTotal(cotizaciones, uf),
                }}
                pdfMode
                pdfLight
                annualOnly
              />
            </div>
          ) : null
        })()}

        {secciones.has('flujo') && anexoTabla60m && activas.length > 0 && (() => {
          const tabla60 = calcularDiversificacion(diversificacion, cotizaciones, uf)
          return tabla60.length > 0 ? (
            <div style={{ padding: '32px 40px', borderBottom: `1px solid ${T.border}`, background: T.bg }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 12, color: T.gold }}>
                📎 Anexo — Tabla detallada de diversificación (60 meses)
              </h2>
              <p style={{ fontSize: 11, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>
                Este anexo es para uso de revisión detallada y apoyo operativo/comercial en reuniones.
              </p>
              <TablaCashflow60m
                tabla={tabla60}
                mesesEntrega={[
                  ...new Set(activas.map((c) => c.mes_entrega_flujo).filter((m): m is number => m != null)),
                ].sort((a, b) => a - b)}
                mesesIVA={[
                  ...new Set(
                    activas
                      .filter((c) => c.califica_iva && c.mes_entrega_flujo != null)
                      .map((c) => (c.mes_entrega_flujo as number) + 5)
                      .filter((m) => m >= 1 && m <= 60)
                  ),
                ].sort((a, b) => a - b)}
                resumenContexto={{
                  capitalInicialClp: diversificacion.diversif_capital_inicial_clp,
                  tasaMensualDecimal: diversificacion.diversif_tasa_mensual,
                  gastosOperacionalesClp: diversificacion.diversif_gastos_operacionales_clp,
                  amobladoOtrosClp: diversificacion.diversif_amoblado_otros_clp,
                  ahorroMensualClp: diversificacion.diversif_ahorro_mensual_clp,
                  ivaTotalReferenciaClp: diversificacion.diversif_iva_manual_override
                    ? diversificacion.diversif_iva_total_clp
                    : calcularIvaTotal(cotizaciones, uf),
                }}
                pdfMode
                pdfLight
              />
            </div>
          ) : null
        })()}

        <div
          style={{
            padding: '20px 40px',
            background: T.card,
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11, color: T.muted }}>
            <span style={{ color: T.gold, fontWeight: 700 }}>Brekto Inversiones</span> · Cotizador Inmobiliario
          </span>
          <span style={{ fontSize: 11, color: T.muted }}>{new Date().toLocaleDateString('es-CL')} · Uso confidencial</span>
        </div>
      </div>
    </div>
  )
}
