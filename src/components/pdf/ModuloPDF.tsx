import { createContext, useContext, useState, useRef } from 'react'
import { repartirEnHojas } from './repartirEnHojas'
import { Bloque, useAlturas, esperarLayoutEstable, MEDICION_STYLE } from './useAlturas'
import { useAppStore } from '@/store/useAppStore'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import { calcularDiversificacion, calcularIvaTotal, devolucionIvaCotizacionClp } from '@/lib/engines/calculosDiversificacion'
import { calcularMontosDesglosePieClp } from '@/lib/engines/calculosPie'
import { bonoPiePct, bonoPieUf, pieAPagarUf, tieneBonoPie } from '@/lib/engines/desglosePieUf'
import { cotizacionEfectiva, esCompraContado } from '@/lib/engines/compraContado'
import { precioCompraDeptoUf } from '@/lib/engines/precioCompra'
import { seriePatrimonioTotalUf, liquidezVentaUnidadClp } from '@/lib/engines/resumenGraficos'
import TablaCashflow60m from '@/components/flujo/TablaCashflow60m'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { Cotizacion, DatosDiversificacion, PromocionesCotizacion, ResultadosCotizacion } from '@/types'
import { DEFAULT_PROMOCIONES } from '@/types'
import brektoIsotipoUrl from '@/assets/ISOTIPO.BRIKTO-2.png'
import { MAX_COTIZACIONES, letraCotizacion } from '@/lib/cotizaciones'

const fmtUF = (v: number) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`
const fmtCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

/** Paleta clara para impresión (fondo blanco). */
const T = {
  bg: '#ffffff',
  card: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  gold: '#b45309',
  // Azul oscuro corporativo Brekto (logo). Si necesita ajuste fino, modificar solo aquí.
  accent: '#0d4d80',
  good: '#059669',
  bad: '#b91c1c',
}

// Labels para las promociones tipo bool. `gift_card_cliente` se maneja aparte
// porque lleva un monto CLP asociado que se inyecta en la leyenda.
const PROMO_LABELS: [Exclude<keyof PromocionesCotizacion, 'gift_card_cliente_clp'>, string][] = [
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

function leyendaPromociones(p: PromocionesCotizacion | undefined): string[] {
  const base = { ...DEFAULT_PROMOCIONES, ...p }
  return PROMO_LABELS.filter(([k]) => base[k] === true).map(([k, label]) => {
    if (k === 'gift_card_cliente') {
      const monto = base.gift_card_cliente_clp || 0
      return monto > 0 ? `${label} — $${monto.toLocaleString('es-CL')}` : label
    }
    return label
  })
}

const SECCIONES = [
  { id: 'portada', label: 'Hoja 1 — Portada', icon: '🏢' },
  { id: 'resumen', label: 'Hoja 2 — Comparativa de cotizaciones', icon: '📊' },
  { id: 'kpis', label: 'Hoja 3 — KPIs de la inversión', icon: '🎯' },
  { id: 'flujo', label: 'Hoja 4 — Gráficos + Tabla anual', icon: '💰' },
  ...Array.from({ length: MAX_COTIZACIONES }, (_, i) => ({
    id: `cot${letraCotizacion(i)}`,
    label: `Cotización ${letraCotizacion(i)} (2 o más hojas)`,
    icon: '🏠',
  })),
]

/** Cotizaciones por hoja en la tabla comparativa (Hoja 2). */
const COMPARATIVA_POR_HOJA = 10

/** Tarjetas por hoja en los KPIs de la inversión (Hoja 3). */
const KPIS_POR_HOJA = 10

/** Columnas de la grilla de KPIs: con 6–10 tarjetas quedan 2 filas. */
const KPIS_COLUMNAS = 5

/** Separación entre filas de la grilla de KPIs (px). */
const KPIS_GAP_PX = 10

/** Filas mensuales por hoja en el anexo 60m. */
const ANEXO_FILAS_POR_HOJA = 24

const MAX_PDF_BYTES = 10 * 1024 * 1024

// ----- Paginación PDF (formato Letter / Carta) -----
// Cada hoja es un nodo independiente con [data-pdf-page="true"] dentro del preview.
// El exporter los captura uno por uno y los inyecta en su propia página jsPDF
// respetando la orientación declarada — no hay cortes "donde caiga".
const PAGE_LETTER_PORTRAIT_MM = { w: 215.9, h: 279.4 }
const PAGE_LETTER_LANDSCAPE_MM = { w: 279.4, h: 215.9 }
const MM_TO_PX = 96 / 25.4 // ~3.7795 (96 dpi base)

type PdfOrientation = 'portrait' | 'landscape'

// ----- Auto-paginación (B-10) -----
// Cada sección se mide fuera de vista y `repartirEnHojas` decide en qué hoja va: lo que no cabe pasa
// entero a la hoja siguiente. La guardia de generarPDF queda como red final.
const PAD_PORTADA_MM = 20
const PAD_LANDSCAPE_MM = 10
const PAD_COT_MM = 14
const PAD_ANEXO_MM = 6
/** Holgura que se deja libre al fondo de cada hoja (px). */
const MARGEN_SEGURIDAD_PX = 4

const dimsPx = (orientation: PdfOrientation) => {
  const mm = orientation === 'portrait' ? PAGE_LETTER_PORTRAIT_MM : PAGE_LETTER_LANDSCAPE_MM
  return { w: mm.w * MM_TO_PX, h: mm.h * MM_TO_PX }
}
/** Alto disponible para contenido: alto de la hoja − padding arriba y abajo − holgura. */
const altoUtilPx = (orientation: PdfOrientation, paddingMm: number) =>
  dimsPx(orientation).h - 2 * paddingMm * MM_TO_PX - MARGEN_SEGURIDAD_PX
/** Ancho de contenido de la hoja: el contenedor de medición usa este mismo ancho. */
const anchoUtilPx = (orientation: PdfOrientation, paddingMm: number) =>
  dimsPx(orientation).w - 2 * paddingMm * MM_TO_PX

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

type Seccion = { id: string; node: React.ReactNode }

/**
 * Isotipo Brekto — imagen oficial guardada en `src/assets/ISOTIPO.BRIKTO-2.png`.
 * Vite resuelve la URL en build (incluyendo cache busting). html2canvas lo captura
 * como cualquier <img> mientras esté en el mismo origen (no requiere `useCORS`
 * para assets locales).
 */
const BREKTO_TEXT_GRADIENT = 'linear-gradient(90deg, #0a3b8a 0%, #1bbcd8 55%, #00ff9c 100%)'

function BrektoIsotipo({ size = 48 }: { size?: number }) {
  return (
    <img
      src={brektoIsotipoUrl}
      width={size}
      height={size}
      alt="Brekto"
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}

/**
 * Wordmark "Brekto" con degradado corporativo, renderizado como SVG inline.
 * Usar SVG <text fill="url(#grad)"> garantiza que html2canvas y todos los
 * navegadores lo capturen correctamente — `background-clip: text` no era
 * confiable (el degradado se pintaba como rectángulo, no como texto).
 */
function BrektoWordmark({ fontSize = 22 }: { fontSize?: number }) {
  // Aproximación del ancho de "Brekto" en Outfit 800 — el textLength estabiliza el render.
  const width = fontSize * 4.5
  const height = fontSize * 1.2
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'inline-block', verticalAlign: 'baseline', overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`brekto-wordmark-${fontSize}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0a3b8a" />
          <stop offset="55%" stopColor="#1bbcd8" />
          <stop offset="100%" stopColor="#00ff9c" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y={fontSize * 0.95}
        fontFamily="Outfit, sans-serif"
        fontSize={fontSize}
        fontWeight={800}
        fill={`url(#brekto-wordmark-${fontSize})`}
      >
        Brekto
      </text>
    </svg>
  )
}

function PdfPage({
  orientation,
  label,
  children,
  innerPadding = '14mm',
}: {
  orientation: PdfOrientation
  /** Nombre de la hoja para el aviso anti-corte de generarPDF (data-pdf-label). */
  label: string
  children: React.ReactNode
  innerPadding?: string
}) {
  const { w, h } = orientation === 'portrait' ? PAGE_LETTER_PORTRAIT_MM : PAGE_LETTER_LANDSCAPE_MM
  return (
    <div
      data-pdf-page="true"
      data-pdf-orientation={orientation}
      data-pdf-label={label}
      style={{
        width: `${w * MM_TO_PX}px`,
        height: `${h * MM_TO_PX}px`,
        background: '#ffffff',
        color: '#0f172a',
        boxSizing: 'border-box',
        padding: innerPadding,
        marginBottom: 16,
        boxShadow: '0 2px 12px rgba(15,23,42,0.18)',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {children}
    </div>
  )
}

// ----- Helpers visuales reutilizables (paleta clara) -----
// Subtítulos en azul oscuro corporativo (T.accent).
const subTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: T.accent,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginTop: 12,
  marginBottom: 6,
}

/**
 * Densidad compacta (menos padding en Row y margen en SubTitle). Solo se activa en la
 * Hoja 2 de cada cotización (D + E + F + Política), que en el caso peor rozaba el borde.
 */
const CompactaCtx = createContext(false)

const SubTitle = ({ children }: { children: React.ReactNode }) => {
  const compacta = useContext(CompactaCtx)
  return <div style={compacta ? { ...subTitleStyle, marginTop: 10, marginBottom: 5 } : subTitleStyle}>{children}</div>
}

const StatBox = ({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) => (
  <div style={{ padding: '7px 10px', background: T.card, borderRadius: 6, border: `1px solid ${T.border}` }}>
    <div style={{ fontSize: 9, color: T.muted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
    <div style={{ fontSize: 12.5, fontWeight: 700, color: valueColor ?? T.text, lineHeight: 1.25 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{sub}</div>}
  </div>
)

const Grid = ({ cols, children }: { cols: number; children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>{children}</div>
)

// ----- Renderers por bloque (a–g) ya existentes, ahora separados en 2 hojas -----
// ----- Componentes de tabla estilo "Cotización Capital Inteligente" -----
// Cabecera azul oscuro corporativo + texto blanco bold; filas con bordes sutiles;
// `Row destacada` para totales/subtotales en azul oscuro con texto blanco.

function TablaCot({ headers, children, columnAlignments }: {
  headers: string[]
  children: React.ReactNode
  /** "left" | "right" por columna; default: primera = left, resto = right */
  columnAlignments?: ('left' | 'right' | 'center')[]
}) {
  const align = (i: number) => columnAlignments?.[i] ?? (i === 0 ? 'left' : 'right')
  // Sin margen inferior: cada sección va en su Bloque (flow-root) y el SubTitle siguiente aporta la separación.
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ background: T.accent }}>
          {headers.map((h, i) => (
            <th
              key={i}
              style={{
                padding: '7px 10px',
                color: '#ffffff',
                textAlign: align(i),
                fontSize: 9.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Row({ cells, destacada = false, separador = false, columnAlignments }: {
  cells: (string | number | React.ReactNode)[]
  destacada?: boolean
  /** Fila-título de apartado dentro de la tabla (fondo claro, texto azul bold). */
  separador?: boolean
  columnAlignments?: ('left' | 'right' | 'center')[]
}) {
  const align = (i: number) => columnAlignments?.[i] ?? (i === 0 ? 'left' : 'right')
  const compacta = useContext(CompactaCtx)
  const bg = destacada ? T.accent : separador ? T.card : '#ffffff'
  return (
    <tr style={{ background: bg, borderBottom: `1px solid ${T.border}` }}>
      {cells.map((c, i) => (
        <td
          key={i}
          style={{
            padding: compacta ? '5px 10px' : '6px 10px',
            color: destacada ? '#ffffff' : separador ? T.accent : T.text,
            fontSize: 11,
            fontWeight: destacada || separador ? 700 : 400,
            textAlign: align(i),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {c}
        </td>
      ))}
    </tr>
  )
}

// ----- Banda superior tipo "Cotización Capital Inteligente" -----
// Banda full-width azul oscuro con título centrado + subtítulo + fecha/UF.
// Isotipo arriba a la derecha sobre fondo blanco redondeado para contraste.
// Usar siempre dentro de un PdfPage con innerPadding="14mm" para que los
// `margin: -14mm` extiendan la banda hasta los bordes de la hoja.

function CotBandaSuperior({ c, letra, hojaLabel, uf }: {
  c: Cotizacion
  letra: string
  hojaLabel: string
  uf: number
}) {
  const propiedad = c.propiedad
  const fechaStr = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div
      style={{
        background: T.accent,
        color: '#ffffff',
        padding: '16px 20px 14px',
        marginLeft: '-14mm',
        marginRight: '-14mm',
        marginTop: '-14mm',
        // 2 px + los 12 px del SubTitle de la primera sección = los 14 px de siempre (los Bloques no colapsan márgenes).
        marginBottom: 2,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Hoja N de M — esquina superior izquierda */}
      <div style={{ position: 'absolute', top: 12, left: 18, fontSize: 9, opacity: 0.75, letterSpacing: '0.05em', fontWeight: 600 }}>
        {hojaLabel.toUpperCase()}
      </div>
      {/* Isotipo — esquina superior derecha sobre tarjeta blanca */}
      <div style={{ position: 'absolute', top: 10, right: 16, background: '#ffffff', borderRadius: 6, padding: 4, lineHeight: 0 }}>
        <BrektoIsotipo size={28} />
      </div>
      <div style={{ textAlign: 'center', paddingTop: 12 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: '0.02em' }}>
          COTIZACIÓN {letra}
        </div>
        <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 4 }}>
          {propiedad.proyecto_nombre}
          {propiedad.proyecto_comuna && <span> · {propiedad.proyecto_comuna}</span>}
          {propiedad.unidad_numero && <span> · Unidad {propiedad.unidad_numero}</span>}
        </div>
        <div style={{ fontSize: 10, opacity: 0.85 }}>
          {fechaStr}&nbsp;&nbsp;·&nbsp;&nbsp;1 UF = ${uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  )
}

// ----- Sub-bloque de "Información del…" (3 cards en row tipo Resumen General) -----
function InfoCard({ titulo, lineas }: { titulo: string; lineas: { label: string; value: string }[] }) {
  return (
    <div style={{ padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, background: '#ffffff' }}>
      <div style={{ background: T.accent, color: '#ffffff', padding: '4px 8px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'inline-block' }}>
        {titulo}
      </div>
      {lineas.map((l, i) => (
        <div key={i} style={{ fontSize: 10.5, marginBottom: 2, color: T.text, lineHeight: 1.35 }}>
          <span style={{ color: T.muted, fontWeight: 600 }}>{l.label}: </span>
          <span style={{ color: T.text }}>{l.value || '—'}</span>
        </div>
      ))}
    </div>
  )
}

/** Secciones de la primera parte de la cotización: Resumen general, A, B y C (sin la banda). */
function seccionesHoja1(
  c: Cotizacion,
  r: ResultadosCotizacion,
  uf: number,
  global: { asesor_nombre: string; asesor_correo: string; inversionista_nombre: string; inversionista_correo: string; inversionista_rut: string }
): Seccion[] {
  // B-04: se muestra la cotización efectiva (en contado: sin BI, pie 100 % upfront, crédito 0 %).
  const contado = esCompraContado(c)
  const ce = cotizacionEfectiva(c)
  const propiedad = ce.propiedad
  const pie = ce.pie
  const pcDeptoUf = precioCompraDeptoUf(propiedad)
  const descuentoTotalUf = propiedad.descuento_uf
  const beneficioUf = r.beneficio_inmobiliario_uf
  const bonoPie = bonoPieUf(r.valor_escritura_uf, pie)
  const piePagar = pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, pie)
  const desg = calcularMontosDesglosePieClp(r.valor_escritura_uf, pie, uf)
  const tieneEst = propiedad.estacionamiento_uf > 0
  const tieneBod = propiedad.bodega_uf > 0

  // P-16: la inmobiliaria nunca va al cliente; del proyecto solo nombre, comuna y barrio (si lo hay).
  const barrio = propiedad.proyecto_barrio?.trim() ?? ''

  const resumen = (
    <>
      <SubTitle>Resumen general</SubTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <InfoCard
          titulo="Información del Proyecto"
          lineas={[
            { label: 'Proyecto', value: propiedad.proyecto_nombre || '—' },
            { label: 'Comuna', value: propiedad.proyecto_comuna || '—' },
            ...(barrio ? [{ label: 'Barrio', value: barrio }] : []),
            { label: 'Unidad', value: propiedad.unidad_numero || '—' },
            { label: 'Tipo de Entrega', value: propiedad.unidad_entrega || '—' },
          ]}
        />
        <InfoCard
          titulo="Información del Cliente"
          lineas={[
            { label: 'Nombre', value: global.inversionista_nombre || '—' },
            { label: 'RUT', value: global.inversionista_rut || '—' },
            { label: 'Email', value: global.inversionista_correo || '—' },
          ]}
        />
        <InfoCard
          titulo="Información del Ejecutivo"
          lineas={[
            { label: 'Nombre', value: global.asesor_nombre || '—' },
            { label: 'Email', value: global.asesor_correo || '—' },
          ]}
        />
      </div>
    </>
  )

  const a = (
    <>
      <SubTitle>A · Detalle de la unidad</SubTitle>
      <TablaCot
        headers={['Número', 'Piso', 'Orientación', 'Sup. interior', 'Sup. terraza', 'Sup. total']}
        columnAlignments={['center', 'center', 'center', 'right', 'right', 'right']}
      >
        <Row
          columnAlignments={['center', 'center', 'center', 'right', 'right', 'right']}
          cells={[
            propiedad.unidad_numero || '—',
            '—',
            propiedad.unidad_orientacion || '—',
            `${propiedad.unidad_sup_interior_m2} m²`,
            `${propiedad.unidad_sup_terraza_m2} m²`,
            `${propiedad.unidad_sup_total_m2} m²`,
          ]}
        />
      </TablaCot>
    </>
  )

  const b = (
    <>
      {/* B · Detalle de Precio de compra y Valor de Escrituración
            Orden lógico: lista → descuentos → PRECIO COMPRA depto → BI → VALOR ESCRITURACIÓN depto → adicionales → VALOR ESCRITURACIÓN total. */}
      <SubTitle>B · Detalle de Precio de compra y Valor de Escrituración</SubTitle>
      <TablaCot headers={['Concepto', 'Valor UF', 'Valor CLP']}>
        <Row cells={['Precio Lista Depto', fmtUF(propiedad.precio_lista_uf), fmtCLP(propiedad.precio_lista_uf * uf)]} />
        <Row cells={['(−) Descuento', `−${fmtUF(descuentoTotalUf)}`, `−${fmtCLP(descuentoTotalUf * uf)}`]} />
        <Row cells={[
          `(−) Descuento bonificación (${(propiedad.bono_max_pct * 100).toFixed(2)}%)`,
          `−${fmtUF(propiedad.precio_neto_uf * propiedad.bono_max_pct)}`,
          `−${fmtCLP(propiedad.precio_neto_uf * propiedad.bono_max_pct * uf)}`,
        ]} />
        <Row destacada cells={['PRECIO COMPRA (depto)', fmtUF(pcDeptoUf), fmtCLP(pcDeptoUf * uf)]} />
        {!contado && (
          <Row cells={[`(+) Bonificación inmobiliaria (BI ${(propiedad.bono_descuento_pct * 100).toFixed(2)}%)`, `+${fmtUF(beneficioUf)}`, `+${fmtCLP(beneficioUf * uf)}`]} />
        )}
        <Row destacada cells={['VALOR ESCRITURACIÓN DEPARTAMENTO', fmtUF(r.valor_tasacion_uf), fmtCLP(r.valor_tasacion_uf * uf)]} />
        {tieneEst && (
          <Row cells={[
            `(+) Estacionamiento${propiedad.bono_aplica_adicionales && !contado ? ' · con BI' : ''}`,
            `+${fmtUF(propiedad.estacionamiento_uf)}`,
            `+${fmtCLP(propiedad.estacionamiento_uf * uf)}`,
          ]} />
        )}
        {tieneBod && (
          <Row cells={[
            `(+) Bodega${propiedad.bono_aplica_adicionales && !contado ? ' · con BI' : ''}`,
            `+${fmtUF(propiedad.bodega_uf)}`,
            `+${fmtCLP(propiedad.bodega_uf * uf)}`,
          ]} />
        )}
        {(tieneEst || tieneBod) && (
          <Row destacada cells={['VALOR ESCRITURACIÓN TOTAL', fmtUF(r.valor_escritura_uf), fmtCLP(r.valor_escritura_uf * uf)]} />
        )}
      </TablaCot>
    </>
  )

  const cPie = (
    <>
      {/* C · Pie y Forma de Pago
            Configuración del pie a partir del valor escrituración: documentado → bono → a pagar,
            y desglose de cuotas (upfront / antes / después / cuotón / total). */}
      <SubTitle>C · Pie y Forma de Pago</SubTitle>
      {contado ? (
        <TablaCot headers={['Concepto', 'Detalle', 'Valor UF', 'Valor CLP']}>
          <Row destacada cells={['Pago contado (100 %)', 'Pago único', fmtUF(r.pie_total_uf), fmtCLP(r.pie_total_clp)]} />
        </TablaCot>
      ) : (
      <TablaCot headers={['Concepto', 'Detalle', 'Valor UF', 'Valor CLP']}>
        <Row cells={['Pie a documentar', `${(pie.pie_pct * 100).toFixed(2)}% sobre escrituración`, fmtUF(r.pie_total_uf), fmtCLP(r.pie_total_clp)]} />
        {tieneBonoPie(pie) && (
          <Row cells={[
            'Bonificación inmobiliaria (bono pie)',
            `${(bonoPiePct(pie) * 100).toFixed(2)}% s/ escrituración`,
            fmtUF(bonoPie),
            fmtCLP(bonoPie * uf),
          ]} />
        )}
        <Row destacada cells={['PIE A PAGAR (cliente)', '—', fmtUF(piePagar), fmtCLP(piePagar * uf)]} />
        <Row cells={[
          'Upfront',
          `${(pie.upfront_pct * 100).toFixed(2)}%`,
          fmtUF(r.valor_escritura_uf * pie.upfront_pct),
          fmtCLP(desg.monto_upfront_clp),
        ]} />
        <Row cells={[
          `Cuotas antes entrega (${pie.cuotas_antes_entrega_n})`,
          `${(pie.cuotas_antes_entrega_pct * 100).toFixed(2)}%`,
          `${fmtUF((r.valor_escritura_uf * pie.cuotas_antes_entrega_pct) / Math.max(pie.cuotas_antes_entrega_n, 1))} / cuota`,
          `${fmtCLP(desg.monto_cuota_antes_clp)} / cuota`,
        ]} />
        <Row cells={[
          `Cuotas después entrega (${pie.cuotas_despues_entrega_n})`,
          `${(pie.cuotas_despues_entrega_pct * 100).toFixed(2)}%`,
          `${fmtUF((r.valor_escritura_uf * pie.cuotas_despues_entrega_pct) / Math.max(pie.cuotas_despues_entrega_n, 1))} / cuota`,
          `${fmtCLP(desg.monto_cuota_despues_clp)} / cuota`,
        ]} />
        <Row cells={['Total cuotas pie', `${pie.pie_n_cuotas_total} cuotas`, '—', '—']} />
        <Row cells={[
          `Cuotón (${pie.cuoton_n_cuotas} cuotas)`,
          `${(pie.cuoton_pct * 100).toFixed(2)}%`,
          `${fmtUF((r.valor_escritura_uf * pie.cuoton_pct) / Math.max(pie.cuoton_n_cuotas, 1))} / cuota`,
          `${fmtCLP(desg.monto_cuoton_clp)} / cuota`,
        ]} />
      </TablaCot>
      )}
    </>
  )

  return [
    { id: 'resumen', node: resumen },
    { id: 'a', node: a },
    { id: 'b', node: b },
    { id: 'c', node: cPie },
  ]
}

/** Secciones de la segunda parte: D, E, Relación Arriendo/Dividendo, F y Política (sin la banda). */
function seccionesHoja2(
  c: Cotizacion,
  r: ResultadosCotizacion,
  uf: number,
  global: { asesor_nombre: string; asesor_correo: string; inversionista_nombre: string; inversionista_correo: string; inversionista_rut: string },
  cotizaciones: Cotizacion[],
  diversificacion: DatosDiversificacion
): Seccion[] {
  // B-04: crédito efectivo (0 % en compra contado).
  const contado = esCompraContado(c)
  const hip = cotizacionEfectiva(c).hipotecario
  const rent = c.rentabilidad
  const renta = rent.tipo_renta
  const promociones = leyendaPromociones(c.promociones)
  // Misma devolución de IVA que inyecta el flujo 60m para esta unidad (null = no califica).
  const ivaClp = devolucionIvaCotizacionClp(c, cotizaciones, diversificacion, uf)
  const ivaLabel = diversificacion.diversif_iva_manual_override
    ? 'Devolución de IVA (manual, prorrateada)'
    : 'Devolución de IVA (15% s/ precio compra depto)'

  const filaDividendo = contado
    ? <Row cells={['Dividendo (compra contado: sin crédito)', fmtUF(0), fmtCLP(0)]} />
    : <Row cells={['Dividendo mensual', fmtUF(r.hipotecario.dividendo_total_uf), fmtCLP(r.hipotecario.dividendo_total_clp)]} />

  const d = (
    <>
      {/* D · Escrituración y Crédito Hipotecario — datos clave del crédito y dividendo. */}
      <SubTitle>D · Escrituración y Crédito Hipotecario</SubTitle>
      <TablaCot headers={['Concepto', 'Valor UF', 'Valor CLP']}>
        <Row cells={['Valor de escrituración', fmtUF(r.valor_escritura_uf), fmtCLP(r.valor_escritura_uf * uf)]} />
        {contado ? (
          <Row destacada cells={['Compra contado — sin crédito hipotecario', '—', '—']} />
        ) : (
          <>
            <Row cells={['Pie total a documentar', fmtUF(r.pie_total_uf), fmtCLP(r.pie_total_clp)]} />
            <Row destacada cells={[
              `Crédito (${(hip.hipotecario_aprobacion_pct * 100).toFixed(0)}% · ${(hip.hipotecario_tasa_anual * 100).toFixed(2)}% anual · ${hip.hipotecario_plazo_anos} años)`,
              fmtUF(r.hipotecario.monto_credito_uf),
              fmtCLP(r.hipotecario.monto_credito_clp),
            ]} />
            <Row destacada cells={['Dividendo mensual', fmtUF(r.hipotecario.dividendo_total_uf), fmtCLP(r.hipotecario.dividendo_total_clp)]} />
          </>
        )}
      </TablaCot>
    </>
  )

  const e = (
    <>
      {/* E · Resultado de la cotización — outputs clave para decisión del cliente. */}
      <SubTitle>E · Resultado de la cotización</SubTitle>
      <TablaCot headers={['Concepto', 'Valor UF', 'Valor CLP']}>
        <Row cells={[
          `Plusvalía proyectada (${(rent.plusvalia_anual_pct * 100).toFixed(2)}% anual · ${rent.plusvalia_anos} años)`,
          fmtUF(r.plusvalia.precio_venta_5anos_uf),
          fmtCLP(r.plusvalia.precio_venta_5anos_uf * uf),
        ]} />
        <Row destacada cells={[
          'Ganancia por venta del departamento',
          fmtUF(r.plusvalia.ganancia_venta_uf),
          fmtCLP(r.plusvalia.ganancia_venta_clp),
        ]} />
        <Row cells={
          ivaClp == null
            ? [ivaLabel, 'No aplica', 'No aplica']
            : [ivaLabel, uf > 0 ? fmtUF(ivaClp / uf) : '—', fmtCLP(ivaClp)]
        } />
      </TablaCot>
    </>
  )

  const arriendo = (
    <>
      {/* Relación Arriendo / Dividendo (B-08) — sin letra; AG solo si aplica (§3.5.1), mercado siempre.
          Dividendo una sola vez arriba; el monto va en la fila-título de cada apartado para que la Hoja 2 no se corte. */}
      <SubTitle>Relación Arriendo / Dividendo</SubTitle>
      <TablaCot headers={['Concepto', 'Valor UF', 'Valor CLP']}>
        {filaDividendo}
        {r.arriendo.tiene_ag && (
          <>
            <Row separador cells={[`Arriendo garantizado (${r.arriendo.ag_meses} meses)`, '—', fmtCLP(r.arriendo.arriendo_garantizado_clp)]} />
            <Row destacada cells={['Diferencia AG − dividendo', '—', fmtCLP(r.arriendo.diferencia_div_ag_clp)]} />
          </>
        )}
        <Row separador cells={[
          renta === 'corta'
            ? 'Arriendo renta corta (neto mensual)'
            : r.arriendo.tiene_ag
              ? `Arriendo de mercado (desde mes ${r.arriendo.ag_meses + 1})`
              : 'Arriendo de mercado',
          '—',
          fmtCLP(r.arriendo.ingreso_neto_flujo_clp),
        ]} />
        <Row destacada cells={[
          renta === 'corta' ? 'Diferencia renta corta − dividendo' : 'Diferencia mercado − dividendo',
          '—',
          fmtCLP(r.arriendo.resultado_mensual_clp),
        ]} />
      </TablaCot>
    </>
  )

  const f = (
    <>
      <SubTitle>F · Promociones de la Cotización</SubTitle>
      {promociones.length > 0 ? (
        <TablaCot headers={['Promoción aplicable']} columnAlignments={['left']}>
          {promociones.map((txt) => (
            <Row key={txt} columnAlignments={['left']} cells={[txt]} />
          ))}
        </TablaCot>
      ) : (
        <div style={{ fontSize: 11, color: T.muted, fontStyle: 'italic', padding: '6px 10px', border: `1px solid ${T.border}`, borderRadius: 6, background: '#ffffff' }}>
          Sin promociones aplicables para esta cotización.
        </div>
      )}
    </>
  )

  const politica = (
    <div style={{ marginTop: 14, padding: '10px 12px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        Política de Cotización y Reserva
      </div>
      <div style={{ fontSize: 9.5, color: T.text, lineHeight: 1.5 }}>
        La información detallada en esta cotización es referencial y será tratada como un borrador hasta que se realice
        una reserva formal. Antecedentes de precio, descuentos, condiciones y disponibilidad están sujetos a cambios sin
        previo aviso. La cotización no garantiza la disponibilidad de la unidad ni la vigencia de los términos ofrecidos
        hasta que se concrete la reserva.
        {' '}<strong>Asesor:</strong> {global.asesor_nombre || '—'}
        {global.asesor_correo && <span> · {global.asesor_correo}</span>}
        {' '}<strong style={{ marginLeft: 8 }}>Cliente:</strong> {global.inversionista_nombre || '—'}
      </div>
    </div>
  )

  return [
    { id: 'd', node: d },
    { id: 'e', node: e },
    { id: 'arriendo', node: arriendo },
    { id: 'f', node: f },
    { id: 'politica', node: politica },
  ]
}

// ----- Componente principal -----
export default function ModuloPDF() {
  const { cotizaciones, global, diversificacion } = useAppStore()
  const uf = global.uf_valor_clp
  // Por defecto van marcadas todas las cotizaciones activas al montar la pestaña.
  const [secciones, setSecciones] = useState<Set<string>>(() => new Set([
    'portada', 'resumen', 'kpis', 'flujo',
    ...cotizaciones.filter((c) => c.activa).map((c) => `cot${letraCotizacion(c.id)}`),
  ]))
  const [anexoTabla60m, setAnexoTabla60m] = useState(false)
  const [generando, setGenerando] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const { ref: medicionRef, alto, filas } = useAlturas()
  // Asesor y cliente leen del store global. Se editan desde la pestaña Cotización (tarjeta "Datos del Documento").
  const asesor = global.asesor_nombre
  const asesorMail = global.asesor_correo
  const asesorTel = global.asesor_telefono

  const toggleSeccion = (id: string) =>
    setSecciones((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const activas = cotizaciones.filter((c) => c.activa)

  // Pre-cálculos compartidos por las hojas 2 a 4
  const resultados = activas.map((c) => calcularResultadosCotizacion(c, uf))
  // B-04: en compra contado el pie efectivo no tiene bono pie.
  const hayBonoPie = activas.some((c) => tieneBonoPie(cotizacionEfectiva(c).pie))
  const tabla60 = activas.length > 0 ? calcularDiversificacion(diversificacion, cotizaciones, uf) : []
  const dataPatrimonio = activas.length > 0 ? seriePatrimonioTotalUf(activas, resultados) : []
  const dataCajaDiv = tabla60.map((f) => ({ mes: f.mes, caja: f.capital_fin }))
  const extraVentaM60 = activas.reduce(
    (sum, c, i) => sum + liquidezVentaUnidadClp(c, resultados[i], uf),
    0
  )

  // Selector manda en portada, comparativa y KPIs. Pares {c, r} antes de filtrar: `resultados` va por posición en `activas`.
  const enPropuesta = activas
    .map((c, i) => ({ c, r: resultados[i] }))
    .filter(({ c }) => secciones.has(`cot${letraCotizacion(c.id)}`))

  // ----- Reparto en hojas por alturas medidas (B-10) -----
  // Las tablas por filas descuentan su parte fija (título + cabecera), que se repite en cada hoja.
  const filasPortada = filas('portada-tabla', enPropuesta.length)
  const fijoPortada = enPropuesta.length > 0 ? alto('portada-tabla') - suma(filasPortada) : 0
  // El encabezado va como primer ítem: siempre queda en la primera hoja y empuja las filas que no caben.
  const hojasPortada = repartirEnHojas(
    [alto('portada-enc'), ...filasPortada],
    altoUtilPx('portrait', PAD_PORTADA_MM) - fijoPortada
  ).map((idx) => ({ conEncabezado: idx.includes(0), filas: idx.filter((i) => i > 0).map((i) => enPropuesta[i - 1]) }))

  const filasComparativa = filas('comparativa', enPropuesta.length)
  const bloquesComparativa = repartirEnHojas(
    filasComparativa,
    altoUtilPx('landscape', PAD_LANDSCAPE_MM) - (alto('comparativa') - suma(filasComparativa)),
    COMPARATIVA_POR_HOJA
  ).map((idx) => idx.map((i) => enPropuesta[i]))

  // KPIs: se reparten filas de la grilla. Las columnas son las mismas en todas las hojas (como se midieron).
  const kpisColumnas = Math.max(1, Math.min(enPropuesta.length, KPIS_COLUMNAS))
  const kpisFilas = Math.ceil(enPropuesta.length / kpisColumnas)
  const bloquesKpis = repartirEnHojas(
    // Una tarjeta estirada mide lo mismo que su fila; cada fila suma el gap que la separa de la anterior.
    Array.from({ length: kpisFilas }, (_, f) => alto(`kpi-${f * kpisColumnas}`) + KPIS_GAP_PX),
    altoUtilPx('landscape', PAD_LANDSCAPE_MM) - alto('kpis-titulo') + KPIS_GAP_PX,
    Math.max(1, Math.floor(KPIS_POR_HOJA / kpisColumnas))
  ).map((idx) => idx.flatMap((f) => enPropuesta.slice(f * kpisColumnas, (f + 1) * kpisColumnas)))

  const cotsEnPdf = activas
    .filter((c) => secciones.has(`cot${letraCotizacion(c.id)}`))
    .map((c) => {
      const r = calcularResultadosCotizacion(c, uf)
      return {
        c,
        letra: letraCotizacion(c.id),
        hoja1: seccionesHoja1(c, r, uf, global),
        hoja2: seccionesHoja2(c, r, uf, global, cotizaciones, diversificacion),
      }
    })

  const anexoVisible = anexoTabla60m && activas.length > 0 && tabla60.length > 0
  const filasAnexo = filas('anexo', tabla60.length)
  const hojasAnexo = anexoVisible
    ? repartirEnHojas(
        filasAnexo,
        altoUtilPx('landscape', PAD_ANEXO_MM) - (alto('anexo') - suma(filasAnexo)),
        ANEXO_FILAS_POR_HOJA
      ).map((idx): [number, number] => [tabla60[idx[0]].mes, tabla60[idx[idx.length - 1]].mes])
    : []
  const dataFinFinal = dataCajaDiv.map((row, idx) =>
    idx === dataCajaDiv.length - 1 ? { ...row, caja: row.caja + extraVentaM60 } : row
  )
  const patrimonioInicialUf = dataPatrimonio[0]?.patrimonioUf ?? 0
  const patrimonioFinalUf = dataPatrimonio[dataPatrimonio.length - 1]?.patrimonioUf ?? 0
  const cajaInicialClp = dataCajaDiv[0]?.caja ?? 0
  const cajaFinalClp = dataCajaDiv[dataCajaDiv.length - 1]?.caja ?? 0
  const finFinalClp = dataFinFinal[dataFinFinal.length - 1]?.caja ?? 0

  const generarPDF = async () => {
    if (!previewRef.current) return
    setGenerando(true)
    try {
      // Captura con el reparto ya estable (fuentes cargadas y re-medidas).
      await esperarLayoutEstable()
      const pageNodes = Array.from(
        previewRef.current.querySelectorAll<HTMLElement>('[data-pdf-page="true"]')
      )
      if (pageNodes.length === 0) {
        setGenerando(false)
        return
      }

      // Guardia anti-corte: el PdfPage tiene overflow hidden, así que lo que no cabe no sale en el PDF.
      const cortadas = pageNodes
        .filter((node) => node.scrollHeight > node.clientHeight + 1)
        .map((node) => `"${node.dataset.pdfLabel ?? 'sin nombre'}"`)
      if (cortadas.length === 1) {
        window.alert(`La hoja ${cortadas[0]} no cabe completa: puede faltar información.`)
      } else if (cortadas.length > 1) {
        window.alert(`Las hojas ${cortadas.join(', ')} no caben completas: puede faltar información.`)
      }

      // Captura una vez; el loop de calidad solo varía el JPEG quality.
      const canvases = await Promise.all(
        pageNodes.map((node) =>
          html2canvas(node, {
            scale: 1.65,
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

      const orientationOf = (node: HTMLElement): PdfOrientation =>
        node.dataset.pdfOrientation === 'landscape' ? 'landscape' : 'portrait'

      let quality = 0.9
      let lastPdf: jsPDF | null = null
      let lastSize = 0

      for (let attempt = 0; attempt < 14; attempt++) {
        const firstOrientation = orientationOf(pageNodes[0])
        const pdf = new jsPDF({
          orientation: firstOrientation,
          unit: 'mm',
          format: 'letter',
          compress: true,
        })

        pageNodes.forEach((node, i) => {
          const orientation = orientationOf(node)
          const dims = orientation === 'landscape' ? PAGE_LETTER_LANDSCAPE_MM : PAGE_LETTER_PORTRAIT_MM
          if (i > 0) pdf.addPage('letter', orientation)
          const imgData = canvases[i].toDataURL('image/jpeg', quality)
          pdf.addImage(imgData, 'JPEG', 0, 0, dims.w, dims.h)
        })

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

  // Portada: encabezado (solo en la primera hoja) y tabla «Unidades cotizadas», que puede seguir en hojas «(cont.)».
  const encabezadoPortada = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrektoIsotipo size={48} />
          <div>
            <div
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 800,
                fontSize: 22,
                color: T.text,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <BrektoWordmark fontSize={22} />
              <span>Inversiones</span>
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>Proyección de resultado de Inversión Inmobiliaria</div>
          </div>
        </div>
        {/* Esquina superior derecha: fecha + UF */}
        <div style={{ textAlign: 'right', fontSize: 11, color: T.muted, lineHeight: 1.5, paddingTop: 4 }}>
          <div>
            {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontWeight: 700, color: T.text }}>
            1 UF = ${uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 28, color: T.text, marginBottom: 24 }}>
        Propuesta de Inversión
        <br />
        <span style={{ color: T.accent }}>Inmobiliaria</span>
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div style={{ padding: '14px 16px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Asesor comercial
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{asesor || '—'}</div>
          {asesorMail && <div style={{ fontSize: 11, color: T.muted }}>{asesorMail}</div>}
          {asesorTel && <div style={{ fontSize: 11, color: T.muted }}>{asesorTel}</div>}
        </div>
        <div style={{ padding: '14px 16px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Cliente / inversionista
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>
            {global.inversionista_nombre || '—'}
          </div>
          {global.inversionista_rut && <div style={{ fontSize: 11, color: T.muted }}>RUT: {global.inversionista_rut}</div>}
        </div>
      </div>
    </>
  )
  const tablaPortada = (titulo: string, filasTabla: typeof enPropuesta) => (
    <>
      {/* Sin margen superior: el bloque anterior ya deja 24 px (los Bloques no colapsan márgenes). */}
      <div style={{ ...subTitleStyle, marginTop: 0 }}>{titulo}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: T.accent }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#ffffff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cot.</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#ffffff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proyecto</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#ffffff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidad</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#ffffff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipología</th>
          </tr>
        </thead>
        <tbody>
          {filasTabla.map(({ c }) => (
            <tr key={c.id}>
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}`, fontWeight: 700, color: T.gold }}>{letraCotizacion(c.id)}</td>
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}` }}>
                {c.propiedad.proyecto_nombre}
                <span style={{ color: T.muted, fontSize: 11 }}> · {c.propiedad.proyecto_comuna}</span>
              </td>
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}` }}>{c.propiedad.unidad_numero}</td>
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}` }}>{c.propiedad.unidad_tipologia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )

  const contenidoComparativa = (bloque: typeof enPropuesta, sufijo: string) => (
    <>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8, color: T.accent }}>
        📊 Comparativa de Cotizaciones{sufijo}
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 14 }}>
        <thead>
          <tr style={{ background: T.accent }}>
            {['Cot.', 'Proyecto / Unidad', 'Tipología', 'm²', 'Precio compra (UF)', 'Tasación', 'Escrituración', 'Pie doc.', 'Bono pie', 'Pie a pagar', 'Dividendo', 'Plusvalía', 'Cap rate', 'Cap rate AirBnB'].filter((h) => hayBonoPie || h !== 'Bono pie').map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 5px', color: '#ffffff', fontWeight: 700, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloque.map(({ c, r }) => {
            const contado = esCompraContado(c)
            const pieEf = cotizacionEfectiva(c).pie
            const bp = bonoPieUf(r.valor_escritura_uf, pieEf)
            const pp = pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, pieEf)
            return (
              <tr key={c.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '5px', fontWeight: 700, color: T.gold }}>{letraCotizacion(c.id)}</td>
                <td style={{ padding: '5px' }}>
                  <div style={{ fontWeight: 700 }}>{c.propiedad.proyecto_nombre}</div>
                  <div style={{ fontSize: 8, color: T.muted }}>U. {c.propiedad.unidad_numero} · {c.propiedad.proyecto_comuna}</div>
                </td>
                <td style={{ padding: '5px' }}>{c.propiedad.unidad_tipologia}</td>
                <td style={{ padding: '5px' }}>{c.propiedad.unidad_sup_total_m2}</td>
                <td style={{ padding: '5px' }}>
                  <div>{fmtUF(r.precio_compra_total_uf)}</div>
                  <div style={{ fontSize: 8, color: T.muted }}>{fmtCLP(r.precio_compra_total_uf * uf)}</div>
                </td>
                <td style={{ padding: '5px' }}>{fmtUF(r.valor_tasacion_uf)}</td>
                <td style={{ padding: '5px' }}>{fmtUF(r.valor_escritura_uf)}</td>
                <td style={{ padding: '5px' }}>
                  <div style={{ color: T.gold, fontWeight: 700 }}>{(pieEf.pie_pct * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: 8, color: T.muted }}>{fmtUF(r.pie_total_uf)}</div>
                </td>
                {hayBonoPie && (
                  <td style={{ padding: '5px' }}>
                    {tieneBonoPie(pieEf) ? (
                      <>
                        <div>{(bonoPiePct(pieEf) * 100).toFixed(2)}%</div>
                        <div style={{ fontSize: 8, color: T.muted }}>{fmtUF(bp)}</div>
                      </>
                    ) : (
                      <div>—</div>
                    )}
                  </td>
                )}
                <td style={{ padding: '5px' }}>
                  <div style={{ color: T.gold, fontWeight: 700 }}>{fmtUF(pp)}</div>
                  <div style={{ fontSize: 8, color: T.muted }}>{fmtCLP(pp * uf)}</div>
                </td>
                <td style={{ padding: '5px' }}>
                  {contado ? (
                    <div style={{ color: T.gold, fontWeight: 700 }}>Contado</div>
                  ) : (
                    <>
                      <div style={{ color: T.gold, fontWeight: 700 }}>{fmtUF(r.hipotecario.dividendo_total_uf)}</div>
                      <div style={{ fontSize: 8, color: T.muted }}>{fmtCLP(r.hipotecario.dividendo_total_clp)}</div>
                    </>
                  )}
                </td>
                <td style={{ padding: '5px', color: T.good }}>{(c.rentabilidad.plusvalia_anual_pct * 100).toFixed(1)}%</td>
                <td style={{ padding: '5px', color: T.good }}>{(r.arriendo.cap_rate_anual_pct * 100).toFixed(2)}%</td>
                <td style={{ padding: '5px', color: T.gold }}>{(r.arriendo.airbnb_cap_rate_anual_pct * 100).toFixed(2)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
  const tituloKpis = (sufijo: string) => (
    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8, color: T.accent }}>
      🎯 KPIs de la inversión{sufijo}
    </h2>
  )
  const tarjetaKpi = ({ c, r }: (typeof enPropuesta)[number], medir?: string) => (
    <div key={c.id} data-medir={medir} style={{ padding: '10px 12px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: T.accent, marginBottom: 8, fontWeight: 700 }}>
        Cotización {letraCotizacion(c.id)} — {c.propiedad.proyecto_nombre}
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plusvalía proyectada 5 años</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.good }}>{fmtUF(r.plusvalia.precio_venta_5anos_uf)}</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ganancia venta</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{fmtUF(r.plusvalia.ganancia_venta_uf)}</div>
        <div style={{ fontSize: 10, color: T.muted }}>{fmtCLP(r.plusvalia.ganancia_venta_clp)}</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resultado mensual arriendo</div>
        {r.arriendo.tiene_ag ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: r.arriendo.diferencia_div_ag_clp >= 0 ? T.good : T.bad }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: T.muted }}>Con AG ({r.arriendo.ag_meses} meses) </span>
              {fmtCLP(r.arriendo.diferencia_div_ag_clp)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: r.arriendo.diferencia_div_mercado_clp >= 0 ? T.good : T.bad }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: T.muted }}>Mercado </span>
              {fmtCLP(r.arriendo.diferencia_div_mercado_clp)}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 700, color: r.arriendo.resultado_mensual_clp >= 0 ? T.good : T.bad }}>
            {fmtCLP(r.arriendo.resultado_mensual_clp)}
          </div>
        )}
      </div>
    </div>
  )
  const grillaKpis = (bloque: typeof enPropuesta, medir?: boolean) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpisColumnas}, 1fr)`, gap: KPIS_GAP_PX }}>
      {bloque.map((par, i) => tarjetaKpi(par, medir ? `kpi-${i}` : undefined))}
    </div>
  )

  // Anexo 60m: mismas cabeceras (60 meses completos) en cada hoja; cambian solo las filas mensuales.
  const mesesEntregaArr = [
    ...new Set(activas.map((c) => c.mes_entrega_flujo).filter((m): m is number => m != null)),
  ].sort((a, b) => a - b)
  const mesesIVAArr = [
    ...new Set(
      activas
        .filter((c) => c.califica_iva && c.mes_entrega_flujo != null)
        .map((c) => (c.mes_entrega_flujo as number) + 5)
        .filter((m) => m >= 1 && m <= 60)
    ),
  ].sort((a, b) => a - b)
  const resumenContextoComun = {
    capitalInicialClp: diversificacion.diversif_capital_inicial_clp,
    tasaMensualDecimal: diversificacion.diversif_tasa_mensual,
    gastosOperacionalesClp: diversificacion.diversif_gastos_operacionales_clp,
    amobladoOtrosClp: diversificacion.diversif_amoblado_otros_clp,
    ahorroMensualClp: diversificacion.diversif_ahorro_mensual_clp,
    ivaTotalReferenciaClp: diversificacion.diversif_iva_manual_override
      ? diversificacion.diversif_iva_total_clp
      : calcularIvaTotal(cotizaciones, uf),
  }
  const contenidoAnexo = (rango: [number, number], label: string) => (
    <>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 700, marginBottom: 4, color: T.accent }}>
        📎 Anexo · Diversificación — {label}
      </h2>
      <TablaCashflow60m
        tabla={tabla60}
        mesesEntrega={mesesEntregaArr}
        mesesIVA={mesesIVAArr}
        resumenContexto={resumenContextoComun}
        pdfMode
        pdfLight
        mesRango={rango}
        omitResumenAnual
      />
    </>
  )

  // ===== Render del SIDEBAR + PREVIEW =====
  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
      {/* SIDEBAR IZQUIERDO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">👤 Datos del Documento</h3>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Solo lectura · edita en pestaña Cotización</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, lineHeight: 1.5 }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Asesor: </span>
              <strong>{asesor || '—'}</strong>
              {asesorMail && <span style={{ color: 'var(--color-text-muted)' }}> · {asesorMail}</span>}
              {asesorTel && <span style={{ color: 'var(--color-text-muted)' }}> · {asesorTel}</span>}
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Cliente: </span>
              <strong>{global.inversionista_nombre || '—'}</strong>
              {global.inversionista_correo && <span style={{ color: 'var(--color-text-muted)' }}> · {global.inversionista_correo}</span>}
              {global.inversionista_rut && <span style={{ color: 'var(--color-text-muted)' }}> · RUT {global.inversionista_rut}</span>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Secciones a Incluir</h3>
          </div>
          <div className="pdf-sections-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {SECCIONES.map((s) => {
              const idx = s.id.startsWith('cot') ? s.id.charCodeAt(3) - 65 : -1
              const disponible =
                s.id === 'portada' || s.id === 'resumen' || s.id === 'kpis' || s.id === 'flujo' || (idx >= 0 && cotizaciones[idx]?.activa)
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

      {/* PREVIEW DERECHO — cada hoja Letter es un PdfPage independiente */}
      <div
        ref={previewRef}
        style={{
          background: '#e2e8f0',
          padding: 16,
          borderRadius: 12,
          overflow: 'auto',
          minHeight: 600,
          color: T.text,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* HOJA 1 — Portada (portrait). Si las unidades no caben, siguen en hojas «(cont.)». */}
        {secciones.has('portada') && hojasPortada.map((hoja, k) => (
          <PdfPage key={`portada-${k}`} orientation="portrait" label={k === 0 ? 'Portada' : `Portada (cont. ${k})`} innerPadding={`${PAD_PORTADA_MM}mm`}>
            {hoja.conEncabezado && <Bloque>{encabezadoPortada}</Bloque>}
            {hoja.filas.length > 0 && (
              <Bloque>{tablaPortada(k === 0 ? 'Unidades cotizadas' : 'Unidades cotizadas (cont.)', hoja.filas)}</Bloque>
            )}
          </PdfPage>
        ))}

        {/* HOJA 2 — Comparativa de cotizaciones: solo la tabla (landscape) */}
        {secciones.has('resumen') && enPropuesta.length > 0 && bloquesComparativa.map((bloque, b) => (
          <PdfPage
            key={`comparativa-${b}`}
            orientation="landscape"
            label={bloquesComparativa.length > 1 ? `Comparativa ${b + 1}/${bloquesComparativa.length}` : 'Comparativa'}
            innerPadding={`${PAD_LANDSCAPE_MM}mm`}
          >
            <Bloque>
              {contenidoComparativa(bloque, bloquesComparativa.length > 1 ? ` (${b + 1} de ${bloquesComparativa.length})` : '')}
            </Bloque>
          </PdfPage>
        ))}

        {/* HOJA 3 — KPIs de la inversión (landscape) */}
        {secciones.has('kpis') && enPropuesta.length > 0 && bloquesKpis.map((bloque, b) => (
          <PdfPage
            key={`kpis-${b}`}
            orientation="landscape"
            label={bloquesKpis.length > 1 ? `KPIs ${b + 1}/${bloquesKpis.length}` : 'KPIs'}
            innerPadding={`${PAD_LANDSCAPE_MM}mm`}
          >
            <Bloque>{tituloKpis(bloquesKpis.length > 1 ? ` (${b + 1} de ${bloquesKpis.length})` : '')}</Bloque>
            {grillaKpis(bloque)}
          </PdfPage>
        ))}

        {/* HOJA 4 — Gráficos + Tabla resumen anual (landscape) */}
        {secciones.has('flujo') && activas.length > 0 && tabla60.length > 0 && (
          <PdfPage orientation="landscape" label="Gráficos" innerPadding={`${PAD_LANDSCAPE_MM}mm`}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 700, marginBottom: 6, color: T.accent }}>
              📈 Proyección — gráficos y resumen anual
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
              <PdfChartCard
                title="Patrimonio (UF) · 5 años"
                inicio={`Inicio: ${fmtUF(patrimonioInicialUf)}`}
                final={`Final: ${fmtUF(patrimonioFinalUf)}`}
                color={T.gold}
              >
                <LineChart width={290} height={170} data={dataPatrimonio} margin={{ top: 4, right: 8, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="semestre" tick={{ fontSize: 9, fill: T.muted }} label={{ value: 'Semestre', position: 'bottom', fontSize: 9, fill: T.muted }} />
                  <YAxis tick={{ fontSize: 9, fill: T.muted }} tickFormatter={(v) => v.toLocaleString('es-CL')} />
                  <Tooltip />
                  <Line type="monotone" dataKey="patrimonioUf" stroke={T.gold} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </PdfChartCard>

              <PdfChartCard
                title="Caja diversificación · 60 meses"
                inicio={`Inicio: ${fmtCLP(cajaInicialClp)}`}
                final={`Final: ${fmtCLP(cajaFinalClp)}`}
                color="#3b82f6"
              >
                <LineChart width={290} height={170} data={dataCajaDiv} margin={{ top: 4, right: 8, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: T.muted }} label={{ value: 'Mes', position: 'bottom', fontSize: 9, fill: T.muted }} />
                  <YAxis tick={{ fontSize: 9, fill: T.muted }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip />
                  <Line type="monotone" dataKey="caja" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </PdfChartCard>

              <PdfChartCard
                title="Resultado financiero final"
                inicio={`Inicio: ${fmtCLP(cajaInicialClp)}`}
                final={`Final: ${fmtCLP(finFinalClp)}`}
                color={T.good}
              >
                <LineChart width={290} height={170} data={dataFinFinal} margin={{ top: 4, right: 8, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: T.muted }} label={{ value: 'Mes', position: 'bottom', fontSize: 9, fill: T.muted }} />
                  <YAxis tick={{ fontSize: 9, fill: T.muted }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip />
                  <Line type="monotone" dataKey="caja" stroke={T.good} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </PdfChartCard>
            </div>

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
          </PdfPage>
        )}

        {/* HOJAS 5+ — por cada cotización: primera parte (Resumen general + A–C) y segunda parte (D–F + Política),
            cada una repartida por alturas medidas. La segunda parte siempre empieza en hoja nueva. */}
        {cotsEnPdf.map(({ c, letra, hoja1, hoja2 }) => {
          // La banda va en todas las hojas: se descuenta del alto útil.
          const disponible = altoUtilPx('portrait', PAD_COT_MM) - alto(`cot${letra}-banda`)
          const repartir = (secs: Seccion[], compacta: boolean) =>
            repartirEnHojas(secs.map((sec) => alto(`cot${letra}-${sec.id}`)), disponible)
              .map((idx) => ({ secs: idx.map((i) => secs[i]), compacta }))
          const hojas = [...repartir(hoja1, false), ...repartir(hoja2, true)]
          return (
            <div key={`cot-${letra}-wrapper`} style={{ display: 'contents' }}>
              {hojas.map((hoja, n) => (
                <PdfPage key={`cot-${letra}-${n}`} orientation="portrait" label={`Cotización ${letra} · Hoja ${n + 1}`} innerPadding={`${PAD_COT_MM}mm`}>
                  <CompactaCtx.Provider value={hoja.compacta}>
                    <Bloque>
                      <CotBandaSuperior c={c} letra={letra} hojaLabel={`Hoja ${n + 1} de ${hojas.length}`} uf={uf} />
                    </Bloque>
                    {hoja.secs.map((sec) => <Bloque key={sec.id}>{sec.node}</Bloque>)}
                  </CompactaCtx.Provider>
                </PdfPage>
              ))}
            </div>
          )
        })}

        {/* ANEXO opcional 60m — hojas landscape de hasta 24 meses, repartidas por alto medido.
            Las tarjetas de cabecera consolidan los 60 meses completos en todas las hojas. */}
        {hojasAnexo.map((rango, n) => (
          <PdfPage key={`anexo-${rango[0]}-${rango[1]}`} orientation="landscape" label={`Anexo ${rango[0]}–${rango[1]}`} innerPadding={`${PAD_ANEXO_MM}mm`}>
            <Bloque>
              {contenidoAnexo(rango, `meses ${rango[0]}–${rango[1]} (Hoja ${n + 1} de ${hojasAnexo.length} · cabeceras 60 m completos)`)}
            </Bloque>
          </PdfPage>
        ))}

        {/* MEDICIÓN (B-10) — fuera de vista, con el ancho de contenido de cada hoja. Nada de aquí sale en el PDF. */}
        <div ref={medicionRef} data-pdf-medicion aria-hidden style={{ ...MEDICION_STYLE, fontFamily: 'Inter, sans-serif', color: T.text }}>
          {secciones.has('portada') && (
            <div style={{ width: anchoUtilPx('portrait', PAD_PORTADA_MM) }}>
              <Bloque medir="portada-enc">{encabezadoPortada}</Bloque>
              {enPropuesta.length > 0 && (
                <Bloque medir="portada-tabla" filas="portada-tabla">{tablaPortada('Unidades cotizadas', enPropuesta)}</Bloque>
              )}
            </div>
          )}
          {enPropuesta.length > 0 && (
            <div style={{ width: anchoUtilPx('landscape', PAD_LANDSCAPE_MM) }}>
              {secciones.has('resumen') && (
                <Bloque medir="comparativa" filas="comparativa">{contenidoComparativa(enPropuesta, '')}</Bloque>
              )}
              {secciones.has('kpis') && (
                <>
                  <Bloque medir="kpis-titulo">{tituloKpis('')}</Bloque>
                  {grillaKpis(enPropuesta, true)}
                </>
              )}
            </div>
          )}
          <div style={{ width: anchoUtilPx('portrait', PAD_COT_MM) }}>
            {cotsEnPdf.map(({ c, letra, hoja1, hoja2 }) => (
              <div key={letra}>
                <Bloque medir={`cot${letra}-banda`}>
                  <CotBandaSuperior c={c} letra={letra} hojaLabel="" uf={uf} />
                </Bloque>
                {hoja1.map((sec) => <Bloque key={sec.id} medir={`cot${letra}-${sec.id}`}>{sec.node}</Bloque>)}
                <CompactaCtx.Provider value>
                  {hoja2.map((sec) => <Bloque key={sec.id} medir={`cot${letra}-${sec.id}`}>{sec.node}</Bloque>)}
                </CompactaCtx.Provider>
              </div>
            ))}
          </div>
          {anexoVisible && (
            <div style={{ width: anchoUtilPx('landscape', PAD_ANEXO_MM) }}>
              <Bloque medir="anexo" filas="anexo">
                {contenidoAnexo([1, 60], 'meses 1–60 (Hoja 1 de 1 · cabeceras 60 m completos)')}
              </Bloque>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PdfChartCard({
  title,
  inicio,
  final,
  color,
  children,
}: {
  title: string
  inicio: string
  final: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div style={{ padding: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.muted, marginBottom: 4 }}>
        <span style={{ color: T.text }}>{inicio}</span>
        <span style={{ color, fontWeight: 700 }}>{final}</span>
      </div>
      {children}
    </div>
  )
}
