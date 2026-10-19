/**
 * PDF Operacional / UGC / Jira — exportable de uso interno.
 *
 * Una hoja Letter portrait por cotización individual (una 2ª si no cabe, B-10), descarga directa
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
import { devolucionIvaCotizacionClp } from '@/lib/engines/calculosDiversificacion'
import { bonoPiePct, bonoPieUf, pieAPagarUf, tieneBonoPie } from '@/lib/engines/desglosePieUf'
import { cotizacionEfectiva, esCompraContado } from '@/lib/engines/compraContado'
import { precioCompraDeptoUf } from '@/lib/engines/precioCompra'
import brektoIsotipoUrl from '@/assets/ISOTIPO.BRIKTO-2.png'
import { letraCotizacion } from '@/lib/cotizaciones'
import { useAppStore } from '@/store/useAppStore'
import { repartirEnHojas } from './repartirEnHojas'
import { Bloque, useAlturas, esperarLayoutEstable, MEDICION_STYLE } from './useAlturas'

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
const PAD_V_MM = 11
const PAD_H_MM = 12
/** Holgura que se deja libre al fondo de cada hoja (px). */
const MARGEN_SEGURIDAD_PX = 4

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

function PdfOperacionalHojas({ cot, global, inmobiliariaNombre, proyectoNombre, letraCotizacion }: SheetProps) {
  const { ref: medicionRef, alto } = useAlturas()
  const uf = global.uf_valor_clp
  const r: ResultadosCotizacion = calcularResultadosCotizacion(cot, uf)
  // B-04: se muestra la cotización efectiva (en contado: sin BI, pie 100 % upfront, crédito 0 %).
  const contado = esCompraContado(cot)
  const ce = cotizacionEfectiva(cot)
  const propiedad = ce.propiedad
  const pie = ce.pie
  const hip = ce.hipotecario

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
  // BONIFICACIÓN INMOBILIARIA (BI) = delta entre subtotal y valor escrituración. Por construcción del motor:
  // valor_escritura - precio_compra_total = beneficio inmobiliario sobre la base (con/sin BI repercutido en adicionales).
  // No confundir con el bono pie (sección C.1).
  const bonificacionInmobiliariaUf = r.valor_escritura_uf - r.precio_compra_total_uf
  const valorFinalUf = r.valor_escritura_uf

  const bonoPie = bonoPieUf(r.valor_escritura_uf, pie)
  const piePagar = pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, pie)
  const desg = calcularMontosDesglosePieClp(r.valor_escritura_uf, pie, uf)
  const tieneEst = propiedad.estacionamiento_uf > 0
  const tieneBod = propiedad.bodega_uf > 0
  const promociones = leyendaPromociones(cot)
  const cuotonTotalClp = desg.monto_cuoton_clp * Math.max(pie.cuoton_n_cuotas, 1) // monto total tramo cuotón
  // Devolución de IVA de esta unidad, la misma del flujo 60m. Se lee del store (no de los args del
  // exporter) para no tocar su firma; el prorrateo manual necesita todas las cotizaciones.
  const { cotizaciones, diversificacion } = useAppStore.getState()
  const ivaClp = devolucionIvaCotizacionClp(cot, cotizaciones, diversificacion, uf)

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

  // Encabezado completo (1ª hoja) y mínimo (hojas siguientes): solo el badge con «Hoja N de M».
  const badge = (hojaTxt: string) => (
    <div style={{ display: 'inline-block', padding: '2px 8px', background: T.accent, color: '#fff', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>
      COTIZACIÓN {letraCotizacion} · USO INTERNO JIRA / OPERACIONES / UGC{contado ? ' · COMPRA CONTADO' : ''}{hojaTxt}
    </div>
  )
  const encabezado = (hojaTxt: string) => (
    <>
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
      {badge(hojaTxt)}
    </>
  )

  const seccionA = (
    <>
      {/* A. Antecedentes de la propiedad */}
      <SubTitle>A · Antecedentes de la propiedad</SubTitle>
      <Grid cols={4}>
        <StatBox label="Unidad" value={propiedad.unidad_numero || '—'} />
        <StatBox label="Tipología" value={propiedad.unidad_tipologia || '—'} />
        <StatBox label="Sup. total" value={`${propiedad.unidad_sup_total_m2} m²`} sub={`int ${propiedad.unidad_sup_interior_m2} / terr ${propiedad.unidad_sup_terraza_m2}`} />
        <StatBox label="Orientación" value={propiedad.unidad_orientacion || '—'} sub={`Entrega: ${propiedad.unidad_entrega || '—'}`} />
      </Grid>
    </>
  )
  const seccionB = (
    <>
      {/* B. Detalle precios y descuentos — flujo izq→der: Lista → (−Descuentos) → SUBTOTAL → (+Bonif al pie) → VALOR FINAL */}
      <SubTitle>B · Detalle precios y descuentos</SubTitle>
      <Grid cols={contado ? 5 : 6}>
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
        {!contado && (
          <StatBox
            label={`Bonificación inmobiliaria (BI ${(propiedad.bono_descuento_pct * 100).toFixed(2)}%)`}
            value={fmtUF(bonificacionInmobiliariaUf)}
            sub={fmtCLP(bonificacionInmobiliariaUf * uf)}
          />
        )}
        <StatBox label="VALOR FINAL" value={fmtUF(valorFinalUf)} sub={fmtCLP(valorFinalUf * uf)} valueColor={T.accent} />
      </Grid>
    </>
  )
  const seccionC1 = (
    <>
      {/* C.1 Pie a documentar (referencia, antes del desglose) */}
      <SubTitle>C.1 · Pie y forma de pago</SubTitle>
      <Grid cols={tieneBonoPie(pie) ? 2 : 1}>
        <StatBox
          label={contado ? 'Pago contado (100 %) · pago único' : `Pie a documentar (${(pie.pie_pct * 100).toFixed(2)}%)`}
          value={fmtUF(r.pie_total_uf)}
          sub={fmtCLP(r.pie_total_clp)}
          valueColor={contado ? T.accent : undefined}
        />
        {tieneBonoPie(pie) && (
          <StatBox
            label={`Bono pie (${(bonoPiePct(pie) * 100).toFixed(2)}% s/ escrituración)`}
            value={fmtUF(bonoPie)}
            sub={fmtCLP(bonoPie * uf)}
          />
        )}
      </Grid>
    </>
  )
  const seccionC2 = (
    <>
      {/* C.2 Pie a pagar + desglose horizontal de cuotas (no aplica en compra contado) */}
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
    </>
  )
  const seccionD = (
    <>
      {/* D. Resumen financiero — UF en bold, $ en gris */}
      <SubTitle>D · Resumen financiero</SubTitle>
      <Grid cols={4}>
        <StatBox
          label="VALOR ESCRITURACIÓN (100%)"
          value={fmtUF(r.valor_escritura_uf)}
          sub={fmtCLP(r.valor_escritura_uf * uf)}
          valueColor={T.accent}
        />
        <StatBox
          label={contado ? 'PAGO CONTADO (100%)' : `PIE A DOCUMENTAR (${(pie.pie_pct * 100).toFixed(2)}%)`}
          value={fmtUF(r.pie_total_uf)}
          sub={fmtCLP(r.pie_total_clp)}
        />
        {contado ? (
          <StatBox label="COMPRA CONTADO" value="Sin crédito" sub="Sin crédito hipotecario ni dividendo" valueColor={T.accent} />
        ) : (
          <StatBox
            label={`MONTO DE CRÉDITO (${(hip.hipotecario_aprobacion_pct * 100).toFixed(2)}%)`}
            value={fmtUF(r.hipotecario.monto_credito_uf)}
            sub={fmtCLP(r.hipotecario.monto_credito_clp)}
            valueColor={T.accent}
          />
        )}
        <StatBox
          label={diversificacion.diversif_iva_manual_override ? 'DEVOLUCIÓN DE IVA (MANUAL)' : 'DEVOLUCIÓN DE IVA'}
          value={ivaClp == null ? 'No aplica' : uf > 0 ? fmtUF(ivaClp / uf) : '—'}
          sub={ivaClp == null ? undefined : fmtCLP(ivaClp)}
        />
      </Grid>
    </>
  )
  const seccionE = (
    <>
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
    </>
  )

  const secciones = [
    { id: 'a', node: seccionA },
    { id: 'b', node: seccionB },
    { id: 'c1', node: seccionC1 },
    // C.2 no aplica en compra contado
    ...(contado ? [] : [{ id: 'c2', node: seccionC2 }]),
    { id: 'd', node: seccionD },
    { id: 'e', node: seccionE },
  ]

  // Reparto (B-10). Toda hoja lleva al menos el encabezado mínimo; la 1ª suma la diferencia con el
  // completo, que va como primer ítem para que quede siempre en ella. En el caso normal: 1 hoja.
  const altoUtil = PAGE_PORTRAIT_MM.h * MM_TO_PX - 2 * PAD_V_MM * MM_TO_PX - MARGEN_SEGURIDAD_PX
  const hojas = repartirEnHojas(
    [alto('enc') - alto('enc-min'), ...secciones.map((sec) => alto(sec.id))],
    altoUtil - alto('enc-min')
  ).map((idx) => idx.filter((i) => i > 0).map((i) => secciones[i - 1]))
  const hojaTxt = (n: number) => (hojas.length > 1 ? ` · HOJA ${n + 1} DE ${hojas.length}` : '')

  const pageStyle: React.CSSProperties = {
    width: `${PAGE_PORTRAIT_MM.w * MM_TO_PX}px`,
    height: `${PAGE_PORTRAIT_MM.h * MM_TO_PX}px`,
    background: '#ffffff',
    color: T.text,
    boxSizing: 'border-box',
    padding: `${PAD_V_MM}mm ${PAD_H_MM}mm`,
    overflow: 'hidden',
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    position: 'relative',
  }

  return (
    <>
      {hojas.map((secs, n) => (
        <div
          key={n}
          data-pdf-page="true"
          data-pdf-label={n === 0 ? `Operacional Cotización ${letraCotizacion}` : `Operacional Cotización ${letraCotizacion} · Hoja ${n + 1}`}
          style={pageStyle}
        >
          {n === 0 ? (
            <>
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

              <Bloque>{encabezado(hojaTxt(n))}</Bloque>
            </>
          ) : (
            <Bloque>{badge(hojaTxt(n))}</Bloque>
          )}
          {secs.map((sec) => <Bloque key={sec.id}>{sec.node}</Bloque>)}
        </div>
      ))}

      {/* MEDICIÓN (B-10) — fuera de vista, mismo ancho de contenido y tipografía que la hoja. */}
      <div
        ref={medicionRef}
        data-pdf-medicion
        aria-hidden
        style={{ ...MEDICION_STYLE, width: PAGE_PORTRAIT_MM.w * MM_TO_PX - 2 * PAD_H_MM * MM_TO_PX, fontFamily: pageStyle.fontFamily, color: T.text }}
      >
        <Bloque medir="enc">{encabezado('')}</Bloque>
        <Bloque medir="enc-min">{badge('')}</Bloque>
        {secciones.map((sec) => <Bloque key={sec.id} medir={sec.id}>{sec.node}</Bloque>)}
      </div>
    </>
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
  const letra = letraCotizacion(cot.id)

  // Container off-screen
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;'
  document.body.appendChild(container)
  const root = createRoot(container)

  try {
    root.render(
      <PdfOperacionalHojas
        cot={cot}
        global={global}
        inmobiliariaNombre={inmobiliariaNombre}
        proyectoNombre={proyectoNombre}
        letraCotizacion={letra}
      />
    )

    // Esperar 2 frames para que React monte; luego fuentes + 2 frames para que el reparto (B-10) quede estable
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    await esperarLayoutEstable()
    // Pequeño extra para que la imagen del isotipo termine de cargar (opcional, en clones rápidos suele estar lista)
    await new Promise((r) => setTimeout(r, 80))

    const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page="true"]'))
    if (nodes.length === 0) throw new Error('No se encontró el nodo de la hoja operacional')

    // Guardia anti-corte: la hoja tiene overflow hidden; lo que no cabe no sale en el PDF.
    const cortada = nodes.find((node) => node.scrollHeight > node.clientHeight + 1)
    if (cortada) {
      window.alert(`La hoja "${cortada.dataset.pdfLabel ?? 'operacional'}" no cabe completa: puede faltar información.`)
    }

    // Captura
    const canvases = await Promise.all(
      nodes.map((node) =>
        html2canvas(node, {
          scale: 1.5,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: node.scrollWidth,
          windowHeight: node.scrollHeight,
        })
      )
    )

    // Loop de calidad para mantener < 2 MB
    let quality = 0.85
    let lastPdf: jsPDF | null = null
    let lastSize = 0
    for (let attempt = 0; attempt < 10; attempt++) {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true })
      canvases.forEach((canvas, i) => {
        if (i > 0) pdf.addPage('letter', 'portrait')
        pdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, 215.9, 279.4)
      })
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
