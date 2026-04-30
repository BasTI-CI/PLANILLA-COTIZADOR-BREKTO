/**
 * PDF Operacional / UGC / Jira — exportable de uso interno.
 *
 * Una hoja Letter portrait por cotización individual, descarga directa
 * (sin preview en pantalla). Renderiza off-screen vía createRoot, captura
 * con html2canvas, descarga con jsPDF y desmonta.
 *
 * Misma mecánica de paginación que el comercial (`PdfPage`, formato Letter)
 * pero comprimida a 1 hoja con paleta clara compacta para uso operacional.
 *
 * Audiencia: Operaciones / UGC. NUNCA al cliente.
 */

import { createRoot } from 'react-dom/client'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Cotizacion, DatosGlobales, ResultadosCotizacion } from '@/types'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import { calcularMontosDesglosePieClp } from '@/lib/engines/calculosPie'
import { bonoPieUf, pieAPagarUf } from '@/lib/engines/desglosePieUf'
import { precioCompraDeptoUf } from '@/lib/engines/precioCompra'
import brektoIsotipoUrl from '@/assets/ISOTIPO.BRIKTO-2.png'

const fmtUF = (v: number) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`
const fmtCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const T = {
  card: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#0d4d80',
}

const PAGE_PORTRAIT_MM = { w: 215.9, h: 279.4 }
const MM_TO_PX = 96 / 25.4 // ~3.78

// ----- Helpers visuales (paleta clara, compactos) -----

const subTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: T.accent,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginTop: 10,
  marginBottom: 4,
}

const StatBox = ({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) => (
  <div
    style={{
      padding: '5px 8px',
      background: T.card,
      borderRadius: 5,
      border: `1px solid ${T.border}`,
    }}
  >
    <div style={{ fontSize: 8, color: T.muted, marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
      {label}
    </div>
    <div style={{ fontSize: 11, fontWeight: 700, color: valueColor ?? T.text, lineHeight: 1.2 }}>{value}</div>
    {sub && <div style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>{sub}</div>}
  </div>
)

const Grid = ({ cols, children }: { cols: number; children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>{children}</div>
)

const SubTitle = ({ children }: { children: React.ReactNode }) => <div style={subTitleStyle}>{children}</div>

// ----- Hoja Operacional -----

interface SheetProps {
  cot: Cotizacion
  global: DatosGlobales
  inmobiliariaNombre: string
  proyectoNombre: string
  letraCotizacion: string
}

function PdfOperacionalSheet({ cot, global, inmobiliariaNombre, proyectoNombre, letraCotizacion }: SheetProps) {
  const uf = global.uf_valor_clp
  const r: ResultadosCotizacion = calcularResultadosCotizacion(cot, uf)
  const propiedad = cot.propiedad
  const pie = cot.pie
  const hip = cot.hipotecario

  // Cálculos derivados — algunos no tienen helper directo en motor
  const pcDeptoUf = precioCompraDeptoUf(propiedad)
  const descuentoTotalUf = propiedad.descuento_uf
  const pctDescuento = propiedad.precio_lista_uf > 0
    ? (descuentoTotalUf / propiedad.precio_lista_uf) * 100
    : 0
  const bonoMaxPct = propiedad.bono_max_pct
  const descuentoBonoUf = propiedad.precio_neto_uf * bonoMaxPct  // monto del descuento por bono (sobre precio neto)
  const beneficioUf = r.beneficio_inmobiliario_uf  // BI sobre tasación (depto)
  // SUBTOTAL = depto post-descuentos + adicionales (sin BI). Igual a precio_compra_total_uf por construcción.
  const subtotalUf = r.precio_compra_total_uf
  // BONIFICACIÓN AL PIE (B) = delta entre subtotal y valor escrituración. Por construcción del motor:
  // valor_escritura - precio_compra_total = beneficio inmobiliario sobre la base (con/sin BI repercutido en adicionales).
  const bonificacionAlPieUf = r.valor_escritura_uf - r.precio_compra_total_uf
  const valorFinalUf = r.valor_escritura_uf

  const bonoPie = bonoPieUf(r.valor_escritura_uf, pie)
  const piePagar = pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, pie)
  const desg = calcularMontosDesglosePieClp(r.valor_escritura_uf, pie, uf)
  const tieneEst = propiedad.estacionamiento_uf > 0
  const tieneBod = propiedad.bodega_uf > 0
  const promociones = leyendaPromociones(cot)
  const cuotonTotalClp = desg.monto_cuoton_clp * Math.max(pie.cuoton_n_cuotas, 1) // monto total tramo cuotón

  const headerColStyle: React.CSSProperties = {
    fontSize: 10,
    color: T.text,
    lineHeight: 1.4,
  }
  const headerLabelStyle: React.CSSProperties = {
    fontSize: 8.5,
    color: T.muted,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 2,
  }

  return (
    <div
      data-pdf-page="true"
      style={{
        width: `${PAGE_PORTRAIT_MM.w * MM_TO_PX}px`,
        height: `${PAGE_PORTRAIT_MM.h * MM_TO_PX}px`,
        background: '#ffffff',
        color: T.text,
        boxSizing: 'border-box',
        padding: '11mm 12mm',
        overflow: 'hidden',
        fontFamily: 'Inter, Helvetica, Arial, sans-serif',
        position: 'relative',
      }}
    >
      {/* Fecha + UF — esquina superior DERECHA absoluta, sobre el header */}
      <div
        style={{
          position: 'absolute',
          top: '11mm',
          right: '12mm',
          textAlign: 'right',
          fontSize: 9,
          color: T.muted,
          lineHeight: 1.4,
        }}
      >
        <div>{new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div style={{ fontWeight: 700, color: T.text }}>
          1 UF = ${uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* HEADER: 2 columnas — Asesor (izq) / Cliente (der) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingBottom: 6, paddingRight: 80, borderBottom: `1px solid ${T.border}` }}>
        <div style={headerColStyle}>
          <div style={headerLabelStyle}>Asesor</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{global.asesor_nombre || '—'}</div>
          {global.asesor_correo && <div style={{ color: T.muted, fontSize: 9.5 }}>{global.asesor_correo}</div>}
        </div>
        <div style={headerColStyle}>
          <div style={headerLabelStyle}>Cliente</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{global.inversionista_nombre || '—'}</div>
          {global.inversionista_correo && <div style={{ color: T.muted, fontSize: 9.5 }}>{global.inversionista_correo}</div>}
          {global.inversionista_rut && <div style={{ color: T.muted, fontSize: 9.5 }}>RUT: {global.inversionista_rut}</div>}
        </div>
      </div>

      {/* Sub-header: Inmobiliaria — Proyecto · Comuna */}
      <div style={{ padding: '5px 0 6px', borderBottom: `1px solid ${T.border}`, fontSize: 9.5, color: T.text, marginBottom: 6 }}>
        <strong>{inmobiliariaNombre || propiedad.proyecto_nombre || '—'}</strong>
        <span style={{ color: T.muted }}> &nbsp;—&nbsp; </span>
        <strong>{proyectoNombre || propiedad.proyecto_nombre || '—'}</strong>
        {propiedad.proyecto_comuna && <span style={{ color: T.muted }}> · {propiedad.proyecto_comuna}</span>}
      </div>

      {/* Badge de uso interno */}
      <div style={{ display: 'inline-block', padding: '2px 8px', background: T.accent, color: '#fff', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>
        COTIZACIÓN {letraCotizacion} · USO INTERNO JIRA / OPERACIONES / UGC
      </div>

      {/* A. Antecedentes de la propiedad */}
      <SubTitle>A · Antecedentes de la propiedad</SubTitle>
      <Grid cols={4}>
        <StatBox label="Unidad" value={propiedad.unidad_numero || '—'} />
        <StatBox label="Tipología" value={propiedad.unidad_tipologia || '—'} />
        <StatBox label="Sup. total" value={`${propiedad.unidad_sup_total_m2} m²`} sub={`int ${propiedad.unidad_sup_interior_m2} / terr ${propiedad.unidad_sup_terraza_m2}`} />
        <StatBox label="Orientación" value={propiedad.unidad_orientacion || '—'} sub={`Entrega: ${propiedad.unidad_entrega || '—'}`} />
      </Grid>

      {/* B. Detalle precios y descuentos — flujo izq→der: Lista → (−Descuentos) → SUBTOTAL → (+Bonif al pie) → VALOR FINAL */}
      <SubTitle>B · Detalle precios y descuentos</SubTitle>
      <Grid cols={6}>
        <StatBox label="Precio lista" value={fmtUF(propiedad.precio_lista_uf)} sub={fmtCLP(propiedad.precio_lista_uf * uf)} />
        <StatBox label={`Descuento (${pctDescuento.toFixed(2)}%)`} value={fmtUF(descuentoTotalUf)} sub={fmtCLP(descuentoTotalUf * uf)} />
        <StatBox label={`Desc. por Bono (${(bonoMaxPct * 100).toFixed(2)}%)`} value={fmtUF(descuentoBonoUf)} sub={fmtCLP(descuentoBonoUf * uf)} />
        <StatBox
          label="SUBTOTAL"
          value={fmtUF(subtotalUf)}
          sub={[
            fmtCLP(subtotalUf * uf),
            `Depto ${fmtUF(pcDeptoUf)}${tieneEst ? ` · Est ${fmtUF(propiedad.estacionamiento_uf)}` : ''}${tieneBod ? ` · Bod ${fmtUF(propiedad.bodega_uf)}` : ''}`,
          ].join(' · ')}
        />
        <StatBox label="Bonificación al pie" value={fmtUF(bonificacionAlPieUf)} sub={fmtCLP(bonificacionAlPieUf * uf)} />
        <StatBox label="VALOR FINAL" value={fmtUF(valorFinalUf)} sub={fmtCLP(valorFinalUf * uf)} valueColor={T.accent} />
      </Grid>

      {/* C.1 Pie a documentar (referencia, antes del desglose) */}
      <SubTitle>C.1 · Pie y forma de pago</SubTitle>
      <Grid cols={1}>
        <StatBox
          label={`Pie a documentar (${(pie.pie_pct * 100).toFixed(2)}%)`}
          value={fmtUF(r.pie_total_uf)}
          sub={fmtCLP(r.pie_total_clp)}
        />
      </Grid>

      {/* C.2 Pie a pagar + desglose horizontal de cuotas */}
      <SubTitle>C.2 · Desglose de pago pie restante</SubTitle>
      <Grid cols={1}>
        <StatBox
          label="Pie a pagar en plan de pago"
          value={fmtUF(piePagar)}
          sub={fmtCLP(piePagar * uf)}
          valueColor={T.accent}
        />
      </Grid>
      <Grid cols={4}>
        <StatBox
          label={`Upfront (${(pie.upfront_pct * 100).toFixed(2)}%)`}
          value={fmtUF(r.valor_escritura_uf * pie.upfront_pct)}
          sub={fmtCLP(desg.monto_upfront_clp)}
        />
        <StatBox
          label={`${(pie.cuotas_antes_entrega_pct * 100).toFixed(2)}% antes / ${pie.cuotas_antes_entrega_n} cuotas`}
          value={fmtUF((r.valor_escritura_uf * pie.cuotas_antes_entrega_pct) / Math.max(pie.cuotas_antes_entrega_n, 1))}
          sub={`${fmtCLP(desg.monto_cuota_antes_clp)} / cuota`}
        />
        <StatBox
          label={`${(pie.cuotas_despues_entrega_pct * 100).toFixed(2)}% después / ${pie.cuotas_despues_entrega_n} cuotas`}
          value={fmtUF((r.valor_escritura_uf * pie.cuotas_despues_entrega_pct) / Math.max(pie.cuotas_despues_entrega_n, 1))}
          sub={`${fmtCLP(desg.monto_cuota_despues_clp)} / cuota`}
        />
        <StatBox
          label={`Cuotón contra escritura (${(pie.cuoton_pct * 100).toFixed(2)}%) / ${pie.cuoton_n_cuotas} cuota${pie.cuoton_n_cuotas > 1 ? 's' : ''}`}
          value={fmtUF(r.valor_escritura_uf * pie.cuoton_pct)}
          sub={pie.cuoton_n_cuotas > 1
            ? `Total ${fmtCLP(cuotonTotalClp)} · ${fmtCLP(desg.monto_cuoton_clp)} / cuota`
            : `Total ${fmtCLP(cuotonTotalClp)}`
          }
        />
      </Grid>

      {/* D. Resumen financiero — UF en bold, $ en gris */}
      <SubTitle>D · Resumen financiero</SubTitle>
      <Grid cols={3}>
        <StatBox
          label="VALOR ESCRITURACIÓN (100%)"
          value={fmtUF(r.valor_escritura_uf)}
          sub={fmtCLP(r.valor_escritura_uf * uf)}
          valueColor={T.accent}
        />
        <StatBox
          label={`PIE A DOCUMENTAR (${(pie.pie_pct * 100).toFixed(2)}%)`}
          value={fmtUF(r.pie_total_uf)}
          sub={fmtCLP(r.pie_total_clp)}
        />
        <StatBox
          label={`MONTO DE CRÉDITO (${(hip.hipotecario_aprobacion_pct * 100).toFixed(2)}%)`}
          value={fmtUF(r.hipotecario.monto_credito_uf)}
          sub={fmtCLP(r.hipotecario.monto_credito_clp)}
          valueColor={T.accent}
        />
      </Grid>

      {/* E. Promociones */}
      <SubTitle>E · Promociones de la cotización</SubTitle>
      {promociones.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 16, color: T.text, fontSize: 10, lineHeight: 1.5, columns: promociones.length > 4 ? 2 : 1 }}>
          {promociones.map((txt) => (
            <li key={txt}>{txt}</li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 10, color: T.muted, fontStyle: 'italic' }}>Sin promociones aplicables.</div>
      )}
    </div>
  )
}

// ----- Promociones helper (mismo array que ModuloPDF, replicado para no acoplar) -----

type PromoKey = Exclude<keyof Cotizacion['promociones'], 'gift_card_cliente_clp'>

const PROMO_LABELS: [PromoKey, string][] = [
  ['arriendo_garantizado', 'Arriendo garantizado'],
  ['kit_arriendo', 'Kit de arriendo'],
  ['kit_inversionista', 'Kit de inversionista'],
  ['credito_pie_institucion', 'Crédito pie con institución financiera'],
  ['bono_amoblado', 'Bono amoblado'],
  ['credito_aval', 'Crédito aval'],
  ['promo_gastos_operacionales', 'Promoción gastos operacionales'],
  ['comentario_devolucion_iva', 'Comentario: "Cliente hará devolución de IVA"'],
  ['gift_card_cliente', 'Gift Card cliente'],
]

function leyendaPromociones(cot: Cotizacion): string[] {
  const p = cot.promociones
  if (!p) return []
  return PROMO_LABELS.filter(([k]) => p[k] === true).map(([k, label]) => {
    if (k === 'gift_card_cliente') {
      const monto = p.gift_card_cliente_clp || 0
      return monto > 0 ? `${label} — $${monto.toLocaleString('es-CL')}` : label
    }
    return label
  })
}

// ----- Exporter público -----

const MAX_OPERACIONAL_BYTES = 2 * 1024 * 1024 // 2 MB techo

interface ExportarArgs {
  cot: Cotizacion
  global: DatosGlobales
  inmobiliariaNombre: string
  proyectoNombre: string
}

/**
 * Genera y descarga el PDF Operacional para una cotización.
 * Renderiza off-screen vía createRoot, captura con html2canvas, comprime y descarga.
 */
export async function exportarPdfOperacional({ cot, global, inmobiliariaNombre, proyectoNombre }: ExportarArgs): Promise<void> {
  const letra = String.fromCharCode(65 + cot.id)

  // Container off-screen
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;'
  document.body.appendChild(container)
  const root = createRoot(container)

  try {
    root.render(
      <PdfOperacionalSheet
        cot={cot}
        global={global}
        inmobiliariaNombre={inmobiliariaNombre}
        proyectoNombre={proyectoNombre}
        letraCotizacion={letra}
      />
    )

    // Esperar 2 frames para que React monte y los layouts se estabilicen
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    // Pequeño extra para que la imagen del isotipo termine de cargar (opcional, en clones rápidos suele estar lista)
    await new Promise((r) => setTimeout(r, 80))

    const node = container.querySelector<HTMLElement>('[data-pdf-page="true"]')
    if (!node) throw new Error('No se encontró el nodo de la hoja operacional')

    // Captura
    const canvas = await html2canvas(node, {
      scale: 1.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    })

    // Loop de calidad para mantener < 2 MB
    let quality = 0.85
    let lastPdf: jsPDF | null = null
    let lastSize = 0
    for (let attempt = 0; attempt < 10; attempt++) {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true })
      pdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, 215.9, 279.4)
      const blob = pdf.output('blob')
      lastPdf = pdf
      lastSize = blob.size
      if (blob.size <= MAX_OPERACIONAL_BYTES || quality <= 0.5) break
      quality -= 0.06
    }

    if (!lastPdf) throw new Error('No se pudo generar el PDF operacional')

    const nombre = global.inversionista_nombre.replace(/\s+/g, '_') || 'Cliente'
    const fecha = new Date().toLocaleDateString('es-CL').replace(/\//g, '-')
    lastPdf.save(`Operacional_Cot${letra}_${nombre}_${fecha}.pdf`)

    if (lastSize > MAX_OPERACIONAL_BYTES) {
      // No bloqueante: solo informativo
      // eslint-disable-next-line no-console
      console.warn(`PDF operacional pesa ${(lastSize / 1024 / 1024).toFixed(1)} MB (objetivo ≤ 2 MB).`)
    }
  } finally {
    root.unmount()
    container.remove()
  }
}
