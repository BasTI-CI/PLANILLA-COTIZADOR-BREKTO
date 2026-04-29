import { useState, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import { calcularDiversificacion, calcularIvaTotal } from '@/lib/engines/calculosDiversificacion'
import { calcularMontosDesglosePieClp } from '@/lib/engines/calculosPie'
import { bonoPieUf, pieAPagarUf } from '@/lib/engines/desglosePieUf'
import { precioCompraDeptoUf } from '@/lib/engines/precioCompra'
import { seriePatrimonioTotalUf, liquidezVentaUnidadClp } from '@/lib/engines/resumenGraficos'
import TablaCashflow60m from '@/components/flujo/TablaCashflow60m'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { Cotizacion, PromocionesCotizacion, ResultadosCotizacion } from '@/types'
import { DEFAULT_PROMOCIONES } from '@/types'
import brektoIsotipoUrl from '@/assets/ISOTIPO.BRIKTO-2.png'

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
  { id: 'portada', label: 'Hoja 1 — Portada', icon: '🏢' },
  { id: 'resumen', label: 'Hoja 2 — Comparativa + KPIs', icon: '📊' },
  { id: 'flujo', label: 'Hoja 3 — Gráficos + Tabla anual', icon: '💰' },
  { id: 'cotA', label: 'Cotización A (2 hojas)', icon: '🏠' },
  { id: 'cotB', label: 'Cotización B (2 hojas)', icon: '🏠' },
  { id: 'cotC', label: 'Cotización C (2 hojas)', icon: '🏠' },
  { id: 'cotD', label: 'Cotización D (2 hojas)', icon: '🏠' },
]

const MAX_PDF_BYTES = 10 * 1024 * 1024

// ----- Paginación PDF (formato Letter / Carta) -----
// Cada hoja es un nodo independiente con [data-pdf-page="true"] dentro del preview.
// El exporter los captura uno por uno y los inyecta en su propia página jsPDF
// respetando la orientación declarada — no hay cortes "donde caiga".
const PAGE_LETTER_PORTRAIT_MM = { w: 215.9, h: 279.4 }
const PAGE_LETTER_LANDSCAPE_MM = { w: 279.4, h: 215.9 }
const MM_TO_PX = 96 / 25.4 // ~3.7795 (96 dpi base)

type PdfOrientation = 'portrait' | 'landscape'

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
  children,
  innerPadding = '14mm',
}: {
  orientation: PdfOrientation
  children: React.ReactNode
  innerPadding?: string
}) {
  const { w, h } = orientation === 'portrait' ? PAGE_LETTER_PORTRAIT_MM : PAGE_LETTER_LANDSCAPE_MM
  return (
    <div
      data-pdf-page="true"
      data-pdf-orientation={orientation}
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

const SubTitle = ({ children }: { children: React.ReactNode }) => <div style={subTitleStyle}>{children}</div>

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
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 8 }}>
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

function Row({ cells, destacada = false, columnAlignments }: {
  cells: (string | number | React.ReactNode)[]
  destacada?: boolean
  columnAlignments?: ('left' | 'right' | 'center')[]
}) {
  const align = (i: number) => columnAlignments?.[i] ?? (i === 0 ? 'left' : 'right')
  return (
    <tr style={{ background: destacada ? T.accent : '#ffffff', borderBottom: `1px solid ${T.border}` }}>
      {cells.map((c, i) => (
        <td
          key={i}
          style={{
            padding: '6px 10px',
            color: destacada ? '#ffffff' : T.text,
            fontSize: 11,
            fontWeight: destacada ? 700 : 400,
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
        marginBottom: 14,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Hoja N de 2 — esquina superior izquierda */}
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

function renderBloqueAE(
  c: Cotizacion,
  letra: string,
  r: ResultadosCotizacion,
  uf: number,
  global: { asesor_nombre: string; asesor_correo: string; inversionista_nombre: string; inversionista_correo: string; inversionista_rut: string }
) {
  const propiedad = c.propiedad
  const pie = c.pie
  const hip = c.hipotecario
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

  return (
    <>
      <CotBandaSuperior c={c} letra={letra} hojaLabel="Hoja 1 de 2" uf={uf} />

      <SubTitle>Resumen general</SubTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <InfoCard
          titulo="Información del Proyecto"
          lineas={[
            { label: 'Inmobiliaria', value: propiedad.proyecto_nombre || '—' },
            { label: 'Proyecto', value: propiedad.proyecto_nombre || '—' },
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
        <Row cells={[`(+) Bonificación inmobiliaria (BI ${(propiedad.bono_descuento_pct * 100).toFixed(2)}%)`, `+${fmtUF(beneficioUf)}`, `+${fmtCLP(beneficioUf * uf)}`]} />
        <Row destacada cells={['VALOR ESCRITURACIÓN DEPARTAMENTO', fmtUF(r.valor_tasacion_uf), fmtCLP(r.valor_tasacion_uf * uf)]} />
        {tieneEst && (
          <Row cells={[
            `(+) Estacionamiento${propiedad.bono_aplica_adicionales ? ' · con BI' : ''}`,
            `+${fmtUF(propiedad.estacionamiento_uf)}`,
            `+${fmtCLP(propiedad.estacionamiento_uf * uf)}`,
          ]} />
        )}
        {tieneBod && (
          <Row cells={[
            `(+) Bodega${propiedad.bono_aplica_adicionales ? ' · con BI' : ''}`,
            `+${fmtUF(propiedad.bodega_uf)}`,
            `+${fmtCLP(propiedad.bodega_uf * uf)}`,
          ]} />
        )}
        {(tieneEst || tieneBod) && (
          <Row destacada cells={['VALOR ESCRITURACIÓN TOTAL', fmtUF(r.valor_escritura_uf), fmtCLP(r.valor_escritura_uf * uf)]} />
        )}
      </TablaCot>

      {/* C · Pie y Forma de Pago
            Configuración del pie a partir del valor escrituración: documentado → bono → a pagar,
            y desglose de cuotas (upfront / antes / después / cuotón / total). */}
      <SubTitle>C · Pie y Forma de Pago</SubTitle>
      <TablaCot headers={['Concepto', 'Detalle', 'Valor UF', 'Valor CLP']}>
        <Row cells={['Pie a documentar', `${(pie.pie_pct * 100).toFixed(2)}% sobre escrituración`, fmtUF(r.pie_total_uf), fmtCLP(r.pie_total_clp)]} />
        <Row cells={[
          'Bonificación inmobiliaria (bono pie)',
          `${(pctRestoBonoPie * 100).toFixed(2)}%`,
          fmtUF(bonoPie),
          fmtCLP(bonoPie * uf),
        ]} />
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

      {/* D · Escrituración y Crédito Hipotecario — datos clave del crédito y dividendo. */}
      <SubTitle>D · Escrituración y Crédito Hipotecario</SubTitle>
      <TablaCot headers={['Concepto', 'Valor UF', 'Valor CLP']}>
        <Row cells={['Valor de escrituración', fmtUF(r.valor_escritura_uf), fmtCLP(r.valor_escritura_uf * uf)]} />
        <Row cells={['Pie total a documentar', fmtUF(r.pie_total_uf), fmtCLP(r.pie_total_clp)]} />
        <Row destacada cells={[
          `Crédito (${(hip.hipotecario_aprobacion_pct * 100).toFixed(0)}% · ${(hip.hipotecario_tasa_anual * 100).toFixed(2)}% anual · ${hip.hipotecario_plazo_anos} años)`,
          fmtUF(r.hipotecario.monto_credito_uf),
          fmtCLP(r.hipotecario.monto_credito_clp),
        ]} />
        <Row destacada cells={['Dividendo mensual', fmtUF(r.hipotecario.dividendo_total_uf), fmtCLP(r.hipotecario.dividendo_total_clp)]} />
      </TablaCot>
    </>
  )
}

function renderBloqueFG(
  c: Cotizacion,
  letra: string,
  r: ResultadosCotizacion,
  uf: number,
  global: { asesor_nombre: string; asesor_correo: string; inversionista_nombre: string; inversionista_correo: string; inversionista_rut: string }
) {
  const rent = c.rentabilidad
  const renta = rent.tipo_renta
  const promociones = leyendaPromociones(c.promociones)

  return (
    <>
      <CotBandaSuperior c={c} letra={letra} hojaLabel="Hoja 2 de 2" uf={uf} />

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
        <Row cells={[
          'Dividendo (mensual)',
          fmtUF(r.hipotecario.dividendo_total_uf),
          fmtCLP(r.hipotecario.dividendo_total_clp),
        ]} />
        <Row cells={[
          renta === 'corta' ? 'Arriendo proyectado renta corta (mensual)' : 'Arriendo proyectado mensual',
          '—',
          fmtCLP(r.arriendo.ingreso_neto_flujo_clp),
        ]} />
        <Row destacada cells={[
          'Resultado mensual (arriendo − dividendo)',
          '—',
          fmtCLP(r.arriendo.resultado_mensual_clp),
        ]} />
      </TablaCot>

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
    </>
  )
}

// ----- Componente principal -----
export default function ModuloPDF() {
  const { cotizaciones, global, diversificacion } = useAppStore()
  const uf = global.uf_valor_clp
  const [secciones, setSecciones] = useState<Set<string>>(
    new Set(['portada', 'cotA', 'resumen', 'flujo'])
  )
  const [anexoTabla60m, setAnexoTabla60m] = useState(false)
  const [generando, setGenerando] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
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
  const letras = ['A', 'B', 'C', 'D']

  // Pre-cálculos compartidos por las hojas 2 y 3
  const resultados = activas.map((c) => calcularResultadosCotizacion(c, uf))
  const tabla60 = activas.length > 0 ? calcularDiversificacion(diversificacion, cotizaciones, uf) : []
  const dataPatrimonio = activas.length > 0 ? seriePatrimonioTotalUf(activas, resultados) : []
  const dataCajaDiv = tabla60.map((f) => ({ mes: f.mes, caja: f.capital_fin }))
  const extraVentaM60 = activas.reduce(
    (sum, c, i) => sum + liquidezVentaUnidadClp(c, resultados[i], uf),
    0
  )
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
      const pageNodes = Array.from(
        previewRef.current.querySelectorAll<HTMLElement>('[data-pdf-page="true"]')
      )
      if (pageNodes.length === 0) {
        setGenerando(false)
        return
      }

      // Captura una vez; el loop de calidad solo varía el JPEG quality.
      const canvases = await Promise.all(
        pageNodes.map((node) =>
          html2canvas(node, {
            scale: 1.65,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
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
        {/* HOJA 1 — Portada (portrait) */}
        {secciones.has('portada') && (
          <PdfPage orientation="portrait" innerPadding="20mm">
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

            {activas.length > 0 && (
              <>
                <div style={{ ...subTitleStyle, marginTop: 8 }}>Unidades cotizadas</div>
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
                    {activas.map((c) => (
                      <tr key={c.id}>
                        <td style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}`, fontWeight: 700, color: T.gold }}>{letras[c.id]}</td>
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
            )}

          </PdfPage>
        )}

        {/* HOJA 2 — Comparativa + KPIs (landscape) */}
        {secciones.has('resumen') && activas.length > 0 && (
          <PdfPage orientation="landscape" innerPadding="10mm">
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8, color: T.accent }}>
              📊 Comparativa de Cotizaciones
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 14 }}>
              <thead>
                <tr style={{ background: T.accent }}>
                  {['Cot.', 'Proyecto / Unidad', 'Tipología', 'm²', 'Precio compra (UF)', 'Tasación', 'Escrituración', 'Pie doc.', 'Bono pie', 'Pie a pagar', 'Dividendo', 'Plusvalía', 'Cap rate', 'Cap rate AirBnB'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 5px', color: '#ffffff', fontWeight: 700, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activas.map((c, i) => {
                  const r = resultados[i]
                  const bp = bonoPieUf(r.valor_escritura_uf, c.pie)
                  const pp = pieAPagarUf(r.pie_total_uf, r.valor_escritura_uf, c.pie)
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '5px', fontWeight: 700, color: T.gold }}>{letras[c.id]}</td>
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
                        <div style={{ color: T.gold, fontWeight: 700 }}>{(c.pie.pie_pct * 100).toFixed(0)}%</div>
                        <div style={{ fontSize: 8, color: T.muted }}>{fmtUF(r.pie_total_uf)}</div>
                      </td>
                      <td style={{ padding: '5px' }}>
                        <div>{fmtUF(bp)}</div>
                        <div style={{ fontSize: 8, color: T.muted }}>{fmtCLP(bp * uf)}</div>
                      </td>
                      <td style={{ padding: '5px' }}>
                        <div style={{ color: T.gold, fontWeight: 700 }}>{fmtUF(pp)}</div>
                        <div style={{ fontSize: 8, color: T.muted }}>{fmtCLP(pp * uf)}</div>
                      </td>
                      <td style={{ padding: '5px' }}>
                        <div style={{ color: T.gold, fontWeight: 700 }}>{fmtUF(r.hipotecario.dividendo_total_uf)}</div>
                        <div style={{ fontSize: 8, color: T.muted }}>{fmtCLP(r.hipotecario.dividendo_total_clp)}</div>
                      </td>
                      <td style={{ padding: '5px', color: T.good }}>{(c.rentabilidad.plusvalia_anual_pct * 100).toFixed(1)}%</td>
                      <td style={{ padding: '5px', color: T.good }}>{(r.arriendo.cap_rate_anual_pct * 100).toFixed(2)}%</td>
                      <td style={{ padding: '5px', color: T.gold }}>{(r.arriendo.airbnb_cap_rate_anual_pct * 100).toFixed(2)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8, color: T.accent }}>
              🎯 KPIs de Inversión
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(activas.length, 1)}, 1fr)`, gap: 10 }}>
              {activas.map((c, i) => {
                const r = resultados[i]
                return (
                  <div key={c.id} style={{ padding: '10px 12px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: T.accent, marginBottom: 8, fontWeight: 700 }}>
                      Cotización {letras[c.id]} — {c.propiedad.proyecto_nombre}
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
                      <div style={{ fontSize: 13, fontWeight: 700, color: r.arriendo.resultado_mensual_clp >= 0 ? T.good : T.bad }}>
                        {fmtCLP(r.arriendo.resultado_mensual_clp)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </PdfPage>
        )}

        {/* HOJA 3 — Gráficos + Tabla resumen anual (landscape) */}
        {secciones.has('flujo') && activas.length > 0 && tabla60.length > 0 && (
          <PdfPage orientation="landscape" innerPadding="10mm">
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

        {/* HOJAS 4+ — por cada cotización activa: 2 hojas portrait (a-e en la primera, f-g en la segunda) */}
        {activas.map((c) => {
          const letra = letras[c.id]
          if (!secciones.has(`cot${letra}`)) return null
          const r = calcularResultadosCotizacion(c, uf)
          return (
            <div key={`cot-${letra}-wrapper`} style={{ display: 'contents' }}>
              <PdfPage orientation="portrait" innerPadding="14mm">
                {renderBloqueAE(c, letra, r, uf, global)}
              </PdfPage>
              <PdfPage orientation="portrait" innerPadding="14mm">
                {renderBloqueFG(c, letra, r, uf, global)}
              </PdfPage>
            </div>
          )
        })}

        {/* ANEXO opcional 60m — partido en TRES hojas landscape:
            Hoja A: meses 1–24 · Hoja B: meses 25–48 · Hoja C: meses 49–60.
            Header compactado para que la última fila de cada hoja quepa limpia dentro del overflow:hidden.
            Las tarjetas de cabecera siguen consolidando los 60 meses completos en las tres hojas. */}
        {anexoTabla60m && activas.length > 0 && tabla60.length > 0 && (() => {
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
          const tramos: Array<{ rango: [number, number]; label: string }> = [
            { rango: [1, 24], label: 'meses 1–24 (Hoja 1 de 3 · cabeceras 60 m completos)' },
            { rango: [25, 48], label: 'meses 25–48 (Hoja 2 de 3 · cabeceras 60 m completos)' },
            { rango: [49, 60], label: 'meses 49–60 (Hoja 3 de 3 · cabeceras 60 m completos)' },
          ]

          return (
            <>
              {tramos.map(({ rango, label }) => (
                <PdfPage key={`anexo-${rango[0]}-${rango[1]}`} orientation="landscape" innerPadding="6mm">
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
                </PdfPage>
              ))}
            </>
          )
        })()}
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
