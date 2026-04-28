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

const StatBox = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
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
    <div style={{ fontSize: 11, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>{value}</div>
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
  const promociones = leyendaPromociones(cot)

  return (
    <div
      data-pdf-page="true"
      style={{
        width: `${PAGE_PORTRAIT_MM.w * MM_TO_PX}px`,
        height: `${PAGE_PORTRAIT_MM.h * MM_TO_PX}px`,
        background: '#ffffff',
        color: T.text,
        boxSizing: 'border-box',
        padding: '12mm',
        overflow: 'hidden',
        fontFamily: 'Inter, Helvetica, Arial, sans-serif',
        position: 'relative',
      }}
    >
      {/* HEADER: isotipo izq, datos centro, fecha+UF der */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
        <img src={brektoIsotipoUrl} width={42} height={42} alt="Brekto" style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }} />

        <div style={{ flex: 1, fontSize: 9, lineHeight: 1.4, color: T.text, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
          <div>
            <span style={{ color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Asesor: </span>
            <strong>{global.asesor_nombre || '—'}</strong>
            {global.asesor_correo && <span style={{ color: T.muted }}> · {global.asesor_correo}</span>}
          </div>
          <div>
            <span style={{ color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cliente: </span>
            <strong>{global.inversionista_nombre || '—'}</strong>
            {global.inversionista_correo && <span style={{ color: T.muted }}> · {global.inversionista_correo}</span>}
            {global.inversionista_rut && <span style={{ color: T.muted }}> · RUT {global.inversionista_rut}</span>}
          </div>
          <div>
            <span style={{ color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inmob.: </span>
            <strong>{inmobiliariaNombre || propiedad.proyecto_nombre || '—'}</strong>
          </div>
          <div>
            <span style={{ color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Proyecto: </span>
            <strong>{proyectoNombre || propiedad.proyecto_nombre || '—'}</strong>
            {propiedad.proyecto_comuna && <span style={{ color: T.muted }}> · {propiedad.proyecto_comuna}</span>}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unidad: </span>
            <strong>{propiedad.unidad_numero || '—'}</strong>
            <span style={{ color: T.muted }}> · {propiedad.unidad_tipologia} · {propiedad.unidad_sup_total_m2} m²</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 9, color: T.muted, lineHeight: 1.4, flexShrink: 0 }}>
          <div>{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div style={{ fontWeight: 700, color: T.text }}>1 UF = ${uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Badge de cotización */}
      <div style={{ display: 'inline-block', padding: '2px 8px', background: T.accent, color: '#fff', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>
        COTIZACIÓN {letraCotizacion} · USO INTERNO JIRA / OPERACIONES / UGC
      </div>

      {/* a) Antecedentes de la propiedad */}
      <SubTitle>a · Antecedentes de la propiedad</SubTitle>
      <Grid cols={4}>
        <StatBox label="Unidad" value={propiedad.unidad_numero || '—'} />
        <StatBox label="Tipología" value={propiedad.unidad_tipologia || '—'} />
        <StatBox label="Sup. total" value={`${propiedad.unidad_sup_total_m2} m²`} sub={`int ${propiedad.unidad_sup_interior_m2} / terr ${propiedad.unidad_sup_terraza_m2}`} />
        <StatBox label="Orientación" value={propiedad.unidad_orientacion || '—'} sub={`Entrega: ${propiedad.unidad_entrega || '—'}`} />
      </Grid>

      {/* b) Detalle precios y descuentos */}
      <SubTitle>b · Detalle de precios y descuentos</SubTitle>
      <Grid cols={3}>
        <StatBox label="Precio lista" value={fmtUF(propiedad.precio_lista_uf)} sub={fmtCLP(propiedad.precio_lista_uf * uf)} />
        <StatBox label="Descuento total" value={fmtUF(descuentoTotalUf)} sub={fmtCLP(descuentoTotalUf * uf)} />
        <StatBox label="Descuento por bono (BI)" value={fmtUF(beneficioUf)} sub={fmtCLP(beneficioUf * uf)} />
        <StatBox label="Precio compra depto" value={fmtUF(pcDeptoUf)} sub={fmtCLP(pcDeptoUf * uf)} />
        {tieneEst && (
          <StatBox label="Estacionamiento" value={fmtUF(propiedad.estacionamiento_uf)} sub={fmtCLP(propiedad.estacionamiento_uf * uf)} />
        )}
        {tieneBod && <StatBox label="Bodega" value={fmtUF(propiedad.bodega_uf)} sub={fmtCLP(propiedad.bodega_uf * uf)} />}
        <StatBox label="Bono pie" value={`${(pctRestoBonoPie * 100).toFixed(2)}% · ${fmtUF(bonoPie)}`} sub={fmtCLP(bonoPie * uf)} />
        <StatBox label="Precio compra total" value={fmtUF(r.precio_compra_total_uf)} sub={fmtCLP(r.precio_compra_total_uf * uf)} />
        <StatBox label="Valor escrituración" value={fmtUF(r.valor_escritura_uf)} sub={fmtCLP(r.valor_escritura_uf * uf)} />
      </Grid>

      {/* c) Pie y forma de pago */}
      <SubTitle>c · Pie y forma de pago</SubTitle>
      <Grid cols={3}>
        <StatBox label="Pie a documentar" value={`${(pie.pie_pct * 100).toFixed(2)}% · ${fmtUF(r.pie_total_uf)}`} sub={fmtCLP(r.pie_total_clp)} />
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
        <StatBox label="Cuotas cuotón" value={`${pie.cuoton_n_cuotas}`} sub={`${fmtCLP(desg.monto_cuoton_clp)} / cuota`} />
        <StatBox label="Cuotas totales pie" value={`${pie.pie_n_cuotas_total}`} />
      </Grid>

      {/* d) Tasación y Escrituración */}
      <SubTitle>d · Tasación y escrituración</SubTitle>
      <Grid cols={3}>
        <StatBox label="Valor tasación depto" value={fmtUF(r.valor_tasacion_uf)} sub={fmtCLP(r.valor_tasacion_uf * uf)} />
        <StatBox label="Beneficio inmobiliario" value={`${(propiedad.bono_descuento_pct * 100).toFixed(2)}%`} sub={`${fmtUF(beneficioUf)} · ${fmtCLP(beneficioUf * uf)}`} />
        <StatBox label="Valor escrituración" value={fmtUF(r.valor_escritura_uf)} sub={fmtCLP(r.valor_escritura_uf * uf)} />
      </Grid>

      {/* e) Resumen Financiero */}
      <SubTitle>e · Resumen financiero</SubTitle>
      <Grid cols={3}>
        <StatBox label="Precio compra total" value={fmtUF(r.precio_compra_total_uf)} sub={fmtCLP(r.precio_compra_total_uf * uf)} />
        <StatBox label="Valor escrituración" value={fmtUF(r.valor_escritura_uf)} sub={fmtCLP(r.valor_escritura_uf * uf)} />
        <StatBox label="Pie a documentar" value={fmtUF(r.pie_total_uf)} sub={fmtCLP(r.pie_total_clp)} />
        <StatBox label="Bono pie" value={fmtUF(bonoPie)} sub={fmtCLP(bonoPie * uf)} />
        <StatBox label="Pie a pagar" value={fmtUF(piePagar)} sub={fmtCLP(piePagar * uf)} />
        <StatBox label="Monto crédito" value={fmtUF(r.hipotecario.monto_credito_uf)} sub={fmtCLP(r.hipotecario.monto_credito_clp)} />
      </Grid>

      {/* f) Crédito sobre valor de Escrituración */}
      <SubTitle>f · Crédito sobre valor de escrituración</SubTitle>
      <Grid cols={4}>
        <StatBox label="Monto crédito" value={fmtUF(r.hipotecario.monto_credito_uf)} sub={fmtCLP(r.hipotecario.monto_credito_clp)} />
        <StatBox label="Tasa anual" value={`${(hip.hipotecario_tasa_anual * 100).toFixed(2)}%`} />
        <StatBox label="Plazo" value={`${hip.hipotecario_plazo_anos} años`} />
        <StatBox label="Dividendo mensual" value={fmtUF(r.hipotecario.dividendo_total_uf)} sub={fmtCLP(r.hipotecario.dividendo_total_clp)} />
      </Grid>

      {/* g) Promociones */}
      <SubTitle>g · Promociones de la cotización</SubTitle>
      {promociones.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 16, color: T.text, fontSize: 10, lineHeight: 1.5 }}>
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

const PROMO_LABELS: [keyof Cotizacion['promociones'], string][] = [
  ['arriendo_garantizado', 'Arriendo garantizado'],
  ['kit_arriendo', 'Kit de arriendo'],
  ['kit_inversionista', 'Kit de inversionista'],
  ['credito_pie_institucion', 'Crédito pie con institución financiera'],
  ['bono_amoblado', 'Bono amoblado'],
  ['credito_aval', 'Crédito aval'],
  ['promo_gastos_operacionales', 'Promoción gastos operacionales'],
  ['comentario_devolucion_iva', 'Comentario: "Cliente hará devolución de IVA"'],
]

function leyendaPromociones(cot: Cotizacion): string[] {
  const p = cot.promociones
  if (!p) return []
  return PROMO_LABELS.filter(([k]) => p[k]).map(([, label]) => label)
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
