import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useProyectos, useUnidades } from '@/hooks/useSupabase'
import {
  calcularResultadosCotizacion,
  brutoMensualRentaCortaClp,
  ingresoNetoMensualRentaCortaClp,
} from '@/lib/engines/calculosCotizacion'
import { calcularMontosDesglosePieClp } from '@/lib/engines/calculosPie'
import { precioCompraDeptoUf, precioCompraTotalUf } from '@/lib/engines/precioCompra'
import FormattedNumberInput from '../ui/FormattedNumberInput'
import { isSupabaseConfigured } from '@/lib/supabase'
import { unidadSupabaseToDatosPropiedad, validateUnidadSupabaseForMotor } from '@/lib/stock'
import type { DatosPropiedad } from '@/types'

interface Props { cotizacionId: number }

const formatUF = (v: number) => `${v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`
const formatCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--color-gold)',
        marginTop: 4,
        marginBottom: 2,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(212,168,67,0.28)',
      }}
    >
      {children}
    </div>
  )
}

/** Grilla formulario: columnas suficientemente anchas para etiquetas en una línea */
const rowGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(188px, 1fr))',
  gap: 12,
  alignItems: 'stretch',
}

export default function CotizacionForm({ cotizacionId }: Props) {
  const {
    cotizaciones, global, setPropiedad, setPie, setHipotecario, setRentabilidad,
    setModoFuente, cargarDesdeSupabase,
  } = useAppStore()

  const cot = cotizaciones[cotizacionId]
  const p = cot?.propiedad
  const pie = cot?.pie
  const hip = cot?.hipotecario
  const uf = global.uf_valor_clp

  const [modoManual, setModoManual] = useState(cot?.modo_fuente === 'manual')
  const { proyectos, loading: loadingProys } = useProyectos()
  const [proyectoSelId, setProyectoSelId] = useState<string>('')
  const [unidadSelId, setUnidadSelId] = useState<string>('')
  const { unidades, loading: loadingUnidades, error: errorUnidades } = useUnidades(proyectoSelId)

  useEffect(() => {
    setUnidadSelId('')
  }, [proyectoSelId])

  const handleModoSwitch = (manual: boolean) => {
    setModoManual(manual)
    setModoFuente(cotizacionId, manual ? 'manual' : 'supabase')
  }

  const handleCargarUnidad = (unidadId: string) => {
    const unidad = unidades.find(u => u.id === unidadId)
    const proyecto = proyectos.find(pr => pr.id === proyectoSelId)
    if (!unidad || !proyecto) return

    const valid = validateUnidadSupabaseForMotor(unidad)
    if (!valid.ok && import.meta.env.DEV) {
      console.warn(
        '[stock] Invariantes de unidad con avisos:',
        valid.issues.map((i) => i.message).join(' | ')
      )
    }

    const prop = unidadSupabaseToDatosPropiedad(proyecto, unidad)
    cargarDesdeSupabase(cotizacionId, prop)
  }

  if (!cot) return null

  // Tasación depto: `valor_tasacion_uf` sale del motor `calcularResultadosCotizacion` → `valorTasacionDeptoUf` en `src/lib/engines/calculosCotizacion.ts` (no se calcula en este archivo).
  const res = calcularResultadosCotizacion(cot, uf)

  const precioListaUf = p.precio_lista_uf
  const descuentoUfActual = p.descuento_uf
  /** Precio de compra del depto (tras lista/dcto. y % Bonificación); no confundir con `precio_neto_uf` (solo post-lista). */
  const precioCompraDeptoDisplay = precioCompraDeptoUf(p)
  const descuentoPctLista =
    precioListaUf > 0 ? (descuentoUfActual / precioListaUf) * 100 : 0

  const pieTotalUf = res?.pie_total_uf ?? 0
  const valorEscrituraUf = res?.valor_escritura_uf ?? 0
  const {
    monto_upfront_clp: montoUpfrontClp,
    monto_cuota_antes_clp: montoCuotaAntesClp,
    monto_cuota_despues_clp: montoCuotaDespuesClp,
    monto_cuoton_clp: montoCuotonClp,
  } = calcularMontosDesglosePieClp(valorEscrituraUf, pie, uf)

  /**
   * Reglas (mismo criterio que `validarResultadosCotizacion`): crédito + pie doc = 100% s/ escritura;
   * **pie a documentar ≥ bono pie** donde bono pie = beneficio inmobiliario (`bono_descuento_pct`, un solo %).
   */
  const EPS_PCT_REVISION = 0.0005
  const pctCreditoLt = hip.hipotecario_aprobacion_pct
  const pctPieDoc = pie.pie_pct
  const pctAbonoInicial = pie.upfront_pct
  const pctAntesEntrega = pie.cuotas_antes_entrega_pct
  const pctDespuesEntrega = pie.cuotas_despues_entrega_pct
  const pctCuoton = pie.cuoton_pct
  /** Tramos de pie a cargo del cliente (s/ escritura): upfront + cuotas + cuotón. */
  const pctPieClienteTramos =
    pctAbonoInicial + pctAntesEntrega + pctDespuesEntrega + pctCuoton
  /** Resto = pie doc − tramos (parte bonificada dentro del pie documentado). */
  const pctRestoPieNoTramos = pctPieDoc - pctPieClienteTramos
  const sumaCreditoMasPie = pctCreditoLt + pctPieDoc
  const revisionCreditoPieOk = Math.abs(sumaCreditoMasPie - 1) <= EPS_PCT_REVISION
  /** Tramos no pueden superar el pie documentado (si no, resto negativo). */
  const desglosePieCoherente = pctRestoPieNoTramos >= -EPS_PCT_REVISION
  const pctBonoPieBeneficio = p.bono_descuento_pct
  /** No documentar menos pie que el bono pie (BI) acordado. */
  const pieDocMayorOIgualBonoPie = pctPieDoc + EPS_PCT_REVISION >= pctBonoPieBeneficio
  const revisionPorcentajesOk =
    revisionCreditoPieOk && desglosePieCoherente && pieDocMayorOIgualBonoPie

  return (
    <div className="fade-in cotizacion-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Switch Supabase / Manual ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏠 Fuente de Datos</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Supabase</span>
            <button
              onClick={() => handleModoSwitch(!modoManual)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: modoManual ? 'var(--color-accent)' : 'var(--color-success)',
                position: 'relative', transition: 'background 0.3s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: modoManual ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.3s',
              }} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Manual</span>
          </div>
        </div>

        {/* ── Modo Supabase: seleccionar proyecto/unidad ── */}
        {!modoManual && (
          <>
            {!isSupabaseConfigured() && (
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: '#f59e0b',
                  margin: '0 0 12px',
                  padding: '10px 12px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  borderRadius: 8,
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                }}
              >
                <strong>Modo demostración:</strong> no hay variables <code style={{ fontSize: 11 }}>VITE_SUPABASE_*</code> en{' '}
                <code style={{ fontSize: 11 }}>.env.local</code>. El desplegable de unidades usa{' '}
                <strong>stock de prueba Imagina</strong> embebido en la app (misma forma que la tabla{' '}
                <code style={{ fontSize: 11 }}>Stock_Imagina_Prueba</code>). Con Supabase configurado se listan las filas reales del proyecto.
              </p>
            )}
            <div className="card-grid-2">
              <div className="form-group">
                <label className="form-label">Proyecto</label>
                {loadingProys ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                    <div className="loading-spinner" /> <span style={{ fontSize: 12 }}>Cargando...</span>
                  </div>
                ) : (
                  <select className="form-select" value={proyectoSelId}
                    onChange={(e) => setProyectoSelId(e.target.value)}>
                    <option value="">— Seleccionar proyecto —</option>
                    {proyectos.map((pr) => (
                      <option key={pr.id} value={pr.id}>{pr.nombre} · {pr.comuna}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Unidad / Departamento</label>
                <select
                  className="form-select"
                  key={proyectoSelId}
                  value={unidadSelId}
                  onChange={(e) => {
                    const v = e.target.value
                    setUnidadSelId(v)
                    if (v) handleCargarUnidad(v)
                  }}
                  disabled={!proyectoSelId || loadingUnidades}
                >
                  <option value="">— Seleccionar unidad —</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.numero} · {u.tipologia} · {u.sup_total_m2}m² · {formatUF(u.precio_lista_uf)}
                    </option>
                  ))}
                </select>
                {errorUnidades && (
                  <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 6, marginBottom: 0 }}>
                    No se pudieron cargar unidades: {errorUnidades}
                  </p>
                )}
                {isSupabaseConfigured() && proyectoSelId && !loadingUnidades && !errorUnidades && unidades.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, marginBottom: 0 }}>
                    La consulta no devolvió filas. Comprueba que exista la tabla <code style={{ fontSize: 10 }}>Stock_Imagina_Prueba</code> y políticas RLS para lectura.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Cotización: antecedentes, precios, resumen ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏢 Cotización</h3>
          {cot.activa && <span className="badge badge-green">✓ Activa</span>}
        </div>

        <div style={rowGridStyle}>
          <SectionHeading>ANTECEDENTES PROPIEDAD</SectionHeading>

          {[
            { label: 'Proyecto', key: 'proyecto_nombre', type: 'text' },
            { label: 'Comuna', key: 'proyecto_comuna', type: 'text' },
            { label: 'Barrio', key: 'proyecto_barrio', type: 'text' },
            { label: 'N° Unidad', key: 'unidad_numero', type: 'text' },
            { label: 'Tipología', key: 'unidad_tipologia', type: 'text' },
            { label: 'Sup. Interior m²', key: 'unidad_sup_interior_m2', type: 'number' },
            { label: 'Sup. Terraza m²', key: 'unidad_sup_terraza_m2', type: 'number' },
            { label: 'Sup. Total m²', key: 'unidad_sup_total_m2', type: 'number' },
            { label: 'Orientación', key: 'unidad_orientacion', type: 'text' },
            { label: 'Fecha entrega', key: 'unidad_entrega', type: 'text' },
          ].map(({ label, key, type }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              {type === 'number' ? (
                <FormattedNumberInput
                  className="form-input"
                  value={Number(((p as unknown) as Record<string, string | number>)[key]) || 0}
                  readOnly={!modoManual}
                  onChange={(val) => setPropiedad(cotizacionId, { [key]: val } as Partial<DatosPropiedad>)}
                  decimals={2}
                  style={{ opacity: modoManual ? 1 : 0.7 }}
                />
              ) : (
                <input
                  type={type}
                  className="form-input"
                  value={((p as unknown) as Record<string, string | number>)[key] ?? ''}
                  readOnly={!modoManual}
                  onChange={(e) => setPropiedad(cotizacionId, { [key]: e.target.value } as Partial<DatosPropiedad>)}
                  style={{ opacity: modoManual ? 1 : 0.7 }}
                />
              )}
            </div>
          ))}

          <SectionHeading>DETALLE PRECIOS Y DESCUENTOS</SectionHeading>
          <p
            style={{
              gridColumn: '1 / -1',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              margin: '0 0 4px',
              lineHeight: 1.5,
            }}
          >
            Orden lógico: lista → descuentos comerciales (incl. «Descuento por Bonificación %» si aplica en el motor) → <strong>precio de compra depto</strong> → beneficio inmobiliario (BI) hacia tasación.
            El 3.er descuento secuencial de la planilla ≈ «Descuento por Bonificación»; el BI va <strong>siempre después</strong> del precio de compra. Si el neto ya incluye ese descuento, deja ese % en <strong>0</strong> (evita doble conteo).
          </p>

          <div className="form-group">
            <label className="form-label">Lista (UF)</label>
            <FormattedNumberInput
              className="form-input"
              value={p.precio_lista_uf}
              readOnly={!modoManual}
              decimals={2}
              onChange={(val) => {
                const d = p.descuento_uf
                setPropiedad(cotizacionId, {
                  precio_lista_uf: val,
                  precio_neto_uf: Math.round((val - d) * 100) / 100,
                })
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" title="Equivalente al 1.er descuento % s/ lista en cotizadores secuenciales">
              Dcto. (% s/ lista)
            </label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={descuentoPctLista}
                readOnly={!modoManual}
                decimals={2}
                onChange={(val) => {
                  const lista = p.precio_lista_uf
                  const pct = val / 100
                  const duf = Math.round(lista * pct * 100) / 100
                  setPropiedad(cotizacionId, {
                    descuento_uf: duf,
                    precio_neto_uf: Math.round((lista - duf) * 100) / 100,
                  })
                }}
                style={{ opacity: modoManual ? 1 : 0.7, width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Dcto. (UF)</label>
            <FormattedNumberInput
              className="form-input"
              value={p.descuento_uf}
              readOnly={!modoManual}
              decimals={2}
              onChange={(val) => {
                const lista = p.precio_lista_uf
                setPropiedad(cotizacionId, {
                  descuento_uf: val,
                  precio_neto_uf: Math.round((lista - val) * 100) / 100,
                })
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" title="≈ 3.er descuento secuencial (sobre precio ya rebajado); si el precio de compra depto ya lo incluye, usar 0">
              Descuento por Bonificación (%)
            </label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={p.bono_max_pct * 100}
                readOnly={!modoManual}
                decimals={2}
                onChange={(val) => setPropiedad(cotizacionId, { bono_max_pct: val / 100 } as Partial<DatosPropiedad>)}
                style={{ opacity: modoManual ? 1 : 0.7, width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" title="Equivale a precio_neto × (1 − Desc. por Bonificación %). Si editas el monto, se recalcula precio_neto y descuento sobre lista.">
              Precio de compra depto (UF)
            </label>
            <FormattedNumberInput
              className="form-input"
              value={precioCompraDeptoDisplay}
              readOnly={!modoManual}
              decimals={2}
              onChange={(val) => {
                const lista = p.precio_lista_uf
                const denom = 1 - p.bono_max_pct
                const neto =
                  denom > 1e-12 ? Math.round((val / denom) * 100) / 100 : val
                const duf = Math.round((lista - neto) * 100) / 100
                setPropiedad(cotizacionId, {
                  precio_neto_uf: neto,
                  descuento_uf: Math.max(0, duf),
                })
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" title="Bono pie = beneficio inmobiliario (un solo %). El pie a documentar debe ser ≥ este %.">
              Bono pie / Beneficio inmobiliario (%)
            </label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={p.bono_descuento_pct * 100}
                readOnly={!modoManual}
                decimals={2}
                onChange={(val) => setPropiedad(cotizacionId, { bono_descuento_pct: val / 100 } as Partial<DatosPropiedad>)}
                style={{ opacity: modoManual ? 1 : 0.7, width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Estacionamiento (UF)</label>
            <FormattedNumberInput
              className="form-input"
              value={p.estacionamiento_uf}
              readOnly={!modoManual}
              decimals={2}
              onChange={(val) => setPropiedad(cotizacionId, { estacionamiento_uf: val })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Bodega (UF)</label>
            <FormattedNumberInput
              className="form-input"
              value={p.bodega_uf}
              readOnly={!modoManual}
              decimals={2}
              onChange={(val) => setPropiedad(cotizacionId, { bodega_uf: val })}
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Precio de compra total (UF)</label>
            <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600, opacity: 0.95 }}>
              {formatUF(precioCompraTotalUf(p))}
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {formatCLP(precioCompraTotalUf(p) * uf)} · depto + est. + bod. (post-descuentos, pre-BI)
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" title="Aplicar beneficio inmobiliario % sobre adicionales (estacionamiento y bodega)">
              Benef. inmob. s/ adicionales
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No</span>
              <button
                type="button"
                onClick={() => setPropiedad(cotizacionId, { bono_aplica_adicionales: !p.bono_aplica_adicionales })}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: p.bono_aplica_adicionales ? 'var(--color-success)' : 'var(--color-error)',
                  position: 'relative', transition: 'background 0.25s',
                }}
                title={p.bono_aplica_adicionales ? 'Sí: Descuento por Bonificación (%) también reduce estacionamiento y bodega en escritura' : 'No: adicionales al valor pleno en escritura'}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: p.bono_aplica_adicionales ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.25s',
                  }}
                />
              </button>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sí</span>
            </div>
          </div>

          {cot.activa && (
            <>
              <SectionHeading>TASACIÓN Y ESCRITURACIÓN</SectionHeading>
              {/* UF tasación: `valorTasacionDeptoUf(precio_neto, bono_descuento_pct, bono_max_pct)` en calculosCotizacion.ts */}
              <div className="form-group">
                <label className="form-label">Valor tasación depto (UF)</label>
                <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>
                  {formatUF(res.valor_tasacion_uf)}
                  <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {formatCLP(res.valor_tasacion_uf * uf)}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Valor escrituración (UF)</label>
                <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>
                  {formatUF(res.valor_escritura_uf)}
                  <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {formatCLP(res.valor_escritura_uf * uf)} · tasación depto + estac./bodega en escritura (ver beneficio sobre adicionales)
                  </div>
                </div>
              </div>
            </>
          )}

          <SectionHeading>PIE Y FORMA DE PAGO</SectionHeading>
          <p
            style={{
              gridColumn: '1 / -1',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              margin: '0 0 4px',
              lineHeight: 1.5,
            }}
          >
            Pie documentado = valor escrituración × %. Debe ser <strong>≥ bono pie / beneficio inmobiliario</strong> (mismo % de la sección
            superior): no puedes documentar menos pie que el bono pie frente al banco. Se descompone en <strong>tramos</strong> (upfront, cuotas,
            cuotón) + <strong>resto</strong>. Junto con % crédito = 100% s/ escritura. Tramos sobre{' '}
            <span style={{ color: 'var(--color-text)' }}>valor escrituración</span>; «Resumen financiero» muestra $. Cuotas totales pie → Flujo.
          </p>
          <div className="form-group">
            <label className="form-label">PIE a documentar (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={pie.pie_pct * 100}
                decimals={2}
                onChange={(val) => setPie(cotizacionId, { pie_pct: val / 100 })}
                style={{ width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          {cot.activa && res && (
            <div className="form-group">
              <label className="form-label">Pie total documentado</label>
              <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>
                {formatUF(pieTotalUf)}
                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {formatCLP(pieTotalUf * uf)}
                </div>
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Upfront % (s/ escrit.)</label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={pie.upfront_pct * 100}
                decimals={2}
                onChange={(val) => setPie(cotizacionId, { upfront_pct: val / 100 })}
                style={{ width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" title="% antes entrega sobre valor escrituración">% Antes entr. (s/ escrit.)</label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={pie.cuotas_antes_entrega_pct * 100}
                decimals={2}
                onChange={(val) => setPie(cotizacionId, { cuotas_antes_entrega_pct: val / 100 })}
                style={{ width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">N° cuotas antes entrega</label>
            <FormattedNumberInput
              min={0}
              max={120}
              className="form-input"
              value={pie.cuotas_antes_entrega_n}
              decimals={0}
              onChange={(val) => setPie(cotizacionId, { cuotas_antes_entrega_n: val })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" title="% después entrega sobre valor escrituración">% Después entr. (s/ escrit.)</label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={pie.cuotas_despues_entrega_pct * 100}
                decimals={2}
                onChange={(val) => setPie(cotizacionId, { cuotas_despues_entrega_pct: val / 100 })}
                style={{ width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">N° cuotas después entrega</label>
            <FormattedNumberInput
              min={0}
              max={120}
              className="form-input"
              value={pie.cuotas_despues_entrega_n}
              decimals={0}
              onChange={(val) => setPie(cotizacionId, { cuotas_despues_entrega_n: val })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Cuotón % (s/ escrit.)</label>
            <div className="form-input-group">
              <FormattedNumberInput
                min={0}
                max={100}
                value={pie.cuoton_pct * 100}
                decimals={2}
                onChange={(val) => setPie(cotizacionId, { cuoton_pct: val / 100 })}
                style={{ width: '100%' }}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">N° cuotas cuotón</label>
            <FormattedNumberInput
              min={0}
              max={120}
              className="form-input"
              value={pie.cuoton_n_cuotas}
              decimals={0}
              onChange={(val) => setPie(cotizacionId, { cuoton_n_cuotas: val })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Cuotas totales pie</label>
            <FormattedNumberInput
              min={0}
              max={120}
              className="form-input"
              value={pie.pie_n_cuotas_total}
              decimals={0}
              onChange={(val) => setPie(cotizacionId, { pie_n_cuotas_total: val })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reserva ($)</label>
            <FormattedNumberInput
              className="form-input"
              value={p.reserva_clp}
              decimals={0}
              onChange={(val) => setPropiedad(cotizacionId, { reserva_clp: val })}
            />
          </div>

          {cot.activa && (
            <>
              <SectionHeading>RESUMEN FINANCIERO (desglose en $)</SectionHeading>
              <p
                style={{
                  gridColumn: '1 / -1',
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  margin: '0 0 4px',
                  lineHeight: 1.45,
                }}
              >
                Upfront es pago único. Cuota antes / después / cuotón: monto mensual de cada tramo (tramo en UF ÷ N cuotas, × UF del día).
              </p>
              <div className="form-group">
                <label className="form-label">Monto upfront ($)</label>
                <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>{formatCLP(montoUpfrontClp)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto cuota antes entrega ($)</label>
                <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>{formatCLP(montoCuotaAntesClp)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto cuota después entrega ($)</label>
                <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>{formatCLP(montoCuotaDespuesClp)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto cuota cuotón ($)</label>
                <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>{formatCLP(montoCuotonClp)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Crédito hipotecario ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏦 Crédito hipotecario</h3>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sistema Francés + seguros</span>
        </div>
        <div style={rowGridStyle}>
          <SectionHeading>CRÉDITO SOBRE VALOR ESCRITURACIÓN</SectionHeading>
          <div className="form-group">
            <label className="form-label">Valor escrituración UF</label>
            <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>
              {formatUF(res.valor_escritura_uf)}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">% crédito</label>
            <div className="form-input-group">
              <FormattedNumberInput min={50} max={100}
                value={hip.hipotecario_aprobacion_pct * 100} decimals={2}
                onChange={(val) => setHipotecario(cotizacionId, { hipotecario_aprobacion_pct: val / 100 })} style={{ width: '100%' }} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">PIE a documentar %</label>
            <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>
              {(pie.pie_pct * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
            </div>
          </div>
          <div
            style={{
              gridColumn: '1 / -1',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              lineHeight: 1.35,
              padding: '2px 0 4px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 2,
            }}
          >
            Monto crédito: <strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{formatUF(res.hipotecario.monto_credito_uf)}</strong>
          </div>
          <div className="form-group">
            <label className="form-label">Tasa interés (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={20}
                value={hip.hipotecario_tasa_anual * 100} decimals={2}
                onChange={(val) => setHipotecario(cotizacionId, { hipotecario_tasa_anual: val / 100 })} style={{ width: '100%' }} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Plazo años</label>
            <div className="form-input-group">
              <FormattedNumberInput min={5} max={30}
                value={hip.hipotecario_plazo_anos} decimals={0}
                onChange={(val) => setHipotecario(cotizacionId, { hipotecario_plazo_anos: val })} style={{ width: '100%' }} />
              <span className="suffix">años</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Monto dividendo UF</label>
            <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>
              {formatUF(res.hipotecario.dividendo_total_uf)}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Monto dividendo ($)</label>
            <div className="form-input" style={{ padding: '10px 12px', fontWeight: 600 }}>
              {formatCLP(res.hipotecario.dividendo_total_clp)}
            </div>
          </div>

          <div
            style={{
              gridColumn: '1 / -1',
              marginTop: 8,
              padding: '16px 18px',
              borderRadius: 10,
              background: 'rgba(18, 24, 38, 0.92)',
              border: `1px solid ${revisionPorcentajesOk ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.45)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: revisionPorcentajesOk ? 'var(--color-success)' : '#ef4444',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                {revisionPorcentajesOk ? '✓' : '!'}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>
                Revisión de porcentajes
              </div>
            </div>
            <p
              style={{
                margin: '0 0 14px',
                fontSize: 12,
                color: 'var(--color-text-muted)',
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: 'var(--color-text-secondary)' }}>Sobre el valor de escrituración (100%):</strong> % crédito + % pie
              documentado = 100%. El <strong>bono pie</strong> (mismo % que <strong>beneficio inmobiliario</strong> arriba) debe quedar{' '}
              <strong>contenido en</strong> el % pie a documentar: <strong>pie documentado ≥ bono pie</strong>. Luego ese pie se parte en
              tramos de cliente + resto; el resto no sustituye al bono pie — el total documentado ya lo incluye.
            </p>
            <div
              style={{
                display: 'grid',
                gap: 6,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--color-text-muted)' }}>
                <span>% crédito (LTV) s/ escrit.</span>
                <span>{(pctCreditoLt * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--color-text-muted)' }}>
                <span>% pie documentado s/ escrit.</span>
                <span>{(pctPieDoc * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingLeft: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic',
                  opacity: 0.92,
                }}
              >
                <span>Bono pie = beneficio inmobiliario (mín. que debe caber en % pie doc.)</span>
                <span>
                  {(pctBonoPieBeneficio * 100).toLocaleString('es-CL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  %
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingLeft: 10,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  opacity: 0.95,
                }}
              >
                <span> ↳ % resto pie s/ escrit. (pie doc. − tramos)</span>
                <span>
                  {(Math.max(0, pctRestoPieNoTramos) * 100).toLocaleString('es-CL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  %
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingLeft: 10,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  opacity: 0.95,
                }}
              >
                <span> ↳ % pie cliente (upfront + tramos + cuotón)</span>
                <span>
                  {(pctPieClienteTramos * 100).toLocaleString('es-CL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  %
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingTop: 6,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: revisionCreditoPieOk ? 'var(--color-success)' : '#f87171',
                }}
              >
                <span>Suma crédito + pie doc.</span>
                <span>
                  {(sumaCreditoMasPie * 100).toLocaleString('es-CL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  %
                </span>
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: revisionPorcentajesOk ? 'var(--color-success)' : '#f87171',
                lineHeight: 1.45,
              }}
            >
              {!revisionCreditoPieOk && (
                <span>
                  Ajusta % crédito o % pie documentado: la suma debe ser 100% (ahora{' '}
                  {(sumaCreditoMasPie * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%).
                </span>
              )}
              {revisionCreditoPieOk && !desglosePieCoherente && (
                <span>
                  El desglose del pie (upfront + tramos + cuotón) supera el % pie documentado: reduce tramos o sube el pie (resto pie
                  negativo:{' '}
                  {(pctRestoPieNoTramos * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%).
                </span>
              )}
              {revisionCreditoPieOk && desglosePieCoherente && !pieDocMayorOIgualBonoPie && (
                <span>
                  Sube «PIE a documentar» a al menos el % de bono pie / beneficio inmobiliario ({(pctBonoPieBeneficio * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%): ahora el pie doc. ({(pctPieDoc * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%) es menor.
                </span>
              )}
              {revisionPorcentajesOk && (
                <span>✓ Coherente: LTV + pie = 100%, pie doc. ≥ bono pie, y el desglose no supera el pie documentado.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Rentabilidad ── */}
      <div className="card">
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 className="card-title" style={{ margin: 0 }}>🏘️ Rentabilidad</h3>
            <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
              {(['larga', 'corta'] as const).map((tipo) => {
                const active = cot.rentabilidad.tipo_renta === tipo
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setRentabilidad(cotizacionId, { tipo_renta: tipo })}
                    style={{
                      padding: '6px 14px', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      background: active
                        ? tipo === 'larga' ? 'var(--color-success)' : 'var(--color-gold)'
                        : 'rgba(255,255,255,0.04)',
                      color: active
                        ? tipo === 'larga' ? '#fff' : '#0a0e1a'
                        : 'var(--color-text-muted)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {tipo === 'larga' ? `LARGA${active ? ' · en flujo' : ''}` : `CORTA${active ? ' · en flujo' : ''}`}
                  </button>
                )
              })}
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Larga / Corta</strong> solo define qué ingreso de arriendo entra al flujo de caja y al comparativo arriendo–dividendo.
            Puedes completar ambos escenarios abajo; el resumen numérico usa la opción marcada.
          </p>
        </div>

        <div style={rowGridStyle}>
          <SectionHeading>PLUSVALÍA</SectionHeading>
          <div className="form-group">
            <label className="form-label">Plusvalía anual (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={20}
                value={cot.rentabilidad.plusvalia_anual_pct * 100} decimals={2}
                onChange={(val) => setRentabilidad(cotizacionId, { plusvalia_anual_pct: val / 100 })} style={{width: '100%'}} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Años proyección</label>
            <FormattedNumberInput min={1} max={20} className="form-input"
              value={cot.rentabilidad.plusvalia_anos} decimals={0}
              onChange={(val) => setRentabilidad(cotizacionId, { plusvalia_anos: val })} />
          </div>

          <SectionHeading>RENTABILIDAD ARRIENDO TRADICIONAL</SectionHeading>
          <div className="form-group" style={{ maxWidth: 300 }}>
            <label className="form-label" title="Arriendo mensual neto (CLP)">Arriendo neto mensual ($)</label>
            <FormattedNumberInput min={0} className="form-input"
              placeholder="$CLP neto mensual" decimals={0}
              value={cot.rentabilidad.arriendo_mensual_clp || 0}
              onChange={(val) => setRentabilidad(cotizacionId, { arriendo_mensual_clp: val })} />
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 3, display: 'block', lineHeight: 1.35 }}>
              Neto (corretaje/vacancia descontados). Flujo con <strong>LARGA</strong>.
            </span>
          </div>

          <SectionHeading>RENTABILIDAD ARRIENDO RENTA CORTA</SectionHeading>
          <div className="form-group" style={{ gridColumn: '1 / -1', maxWidth: 720 }}>
            <div style={{ padding: '8px 12px', background: 'rgba(212,168,67,0.08)', borderRadius: 8, fontSize: 11, color: 'var(--color-text-muted)', borderLeft: '3px solid var(--color-gold)', lineHeight: 1.45 }}>
              💡 <strong style={{ color: 'var(--color-text-secondary)' }}>Ingreso neto mensual</strong> = (tarifa/noche × 30 × ocupación) × (1 − admin) − costos mensuales.
              Ese neto es el equivalente al arriendo neto mensual y alimenta el flujo cuando <strong>CORTA</strong> está activo.
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" title="Cobro del propietario por noche (CLP)">Tarifa/noche ($)</label>
            <FormattedNumberInput min={0} className="form-input" decimals={0}
              value={cot.rentabilidad.airbnb_valor_dia_clp || 0}
              onChange={(val) => setRentabilidad(cotizacionId, { airbnb_valor_dia_clp: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Ocupación mensual (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100} style={{ width: '100%' }} decimals={2}
                value={cot.rentabilidad.airbnb_ocupacion_pct * 100}
                onChange={(val) => setRentabilidad(cotizacionId, { airbnb_ocupacion_pct: val / 100 })} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Administración (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100}
                value={cot.rentabilidad.airbnb_admin_pct * 100} decimals={2}
                onChange={(val) => setRentabilidad(cotizacionId, { airbnb_admin_pct: val / 100 })} style={{ width: '100%' }} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Costos mensuales ($)</label>
            <FormattedNumberInput min={0} className="form-input" decimals={0}
              value={cot.rentabilidad.gastos_comunes_clp || 0}
              onChange={(val) => setRentabilidad(cotizacionId, { gastos_comunes_clp: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Ingreso neto mensual ($)</label>
            <div
              className="form-input"
              style={{
                padding: '10px 12px',
                fontWeight: 700,
                color: ingresoNetoMensualRentaCortaClp(cot.rentabilidad) >= 0 ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              {formatCLP(ingresoNetoMensualRentaCortaClp(cot.rentabilidad))}
            </div>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4, display: 'block', lineHeight: 1.35 }}>
              Calculado; mismo valor que entra al flujo con renta <strong>CORTA</strong>.
            </span>
          </div>
          {brutoMensualRentaCortaClp(cot.rentabilidad) > 0 && (() => {
            const bruto = brutoMensualRentaCortaClp(cot.rentabilidad)
            const admin = Math.round(bruto * cot.rentabilidad.airbnb_admin_pct)
            const neto = ingresoNetoMensualRentaCortaClp(cot.rentabilidad)
            return (
              <div style={{ gridColumn: '1 / -1', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                <div><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Bruto mensual</div><div style={{ fontWeight: 700 }}>{formatCLP(bruto)}</div></div>
                <span style={{ color: 'var(--color-text-muted)' }}>−</span>
                <div style={{ color: 'var(--color-error)' }}><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Administración</div><div style={{ fontWeight: 700 }}>{formatCLP(admin)}</div></div>
                <span style={{ color: 'var(--color-text-muted)' }}>−</span>
                <div style={{ color: 'var(--color-error)' }}><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Costos mensuales</div><div style={{ fontWeight: 700 }}>{formatCLP(cot.rentabilidad.gastos_comunes_clp)}</div></div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 18, marginLeft: 'auto', marginRight: 8 }}>=</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#10b981' }}>Neto mensual</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#10b981' }}>{formatCLP(neto)}</div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {cot.activa && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Resultado</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <div className="stat-item">
              <span className="stat-label">Precio de compra total (UF)</span>
              <span className="stat-value gold">{formatUF(res.precio_compra_total_uf)}</span>
              <span className="stat-sub">{formatCLP(res.precio_compra_total_uf * uf)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Valor tasación depto (UF)</span>
              <span className="stat-value">{formatUF(res.valor_tasacion_uf)}</span>
              <span className="stat-sub">{formatCLP(res.valor_tasacion_uf * uf)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Valor escrituración (UF)</span>
              <span className="stat-value">{formatUF(res.valor_escritura_uf)}</span>
              <span className="stat-sub">{formatCLP(res.valor_escritura_uf * uf)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Pie Total</span>
              <span className="stat-value gold">{formatUF(res.pie_total_uf)}</span>
              <span className="stat-sub">{formatCLP(res.pie_total_clp)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Monto Crédito</span>
              <span className="stat-value blue">{formatUF(res.hipotecario.monto_credito_uf)}</span>
              <span className="stat-sub">{formatCLP(res.hipotecario.monto_credito_clp)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Dividendo Mensual</span>
              <span className="stat-value gold">{formatUF(res.hipotecario.dividendo_total_uf)}</span>
              <span className="stat-sub">{formatCLP(res.hipotecario.dividendo_total_clp)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">
                {cot.rentabilidad.tipo_renta === 'corta' ? 'Ingreso neto renta corta' : 'Arriendo neto mensual'}
              </span>
              <span className="stat-value" style={{ color: res.arriendo.ingreso_neto_flujo_clp > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {formatCLP(res.arriendo.ingreso_neto_flujo_clp)}
              </span>
              <span className="stat-sub" style={{ color: res.arriendo.resultado_mensual_clp >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                vs dividendo: {formatCLP(res.arriendo.resultado_mensual_clp)}/mes
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
