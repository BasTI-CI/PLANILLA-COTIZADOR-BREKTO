import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useProyectos, useUnidades } from '@/hooks/useSupabase'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'
import FormattedNumberInput from '../ui/FormattedNumberInput'
import type { DatosPropiedad } from '@/types'

interface Props { cotizacionId: number }

const formatUF = (v: number) => `${v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`
const formatCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`
const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`

export default function CotizacionForm({ cotizacionId }: Props) {
  const {
    cotizaciones, global, setPropiedad, setPie, setHipotecario, setRentabilidad,
    setModoFuente, cargarDesdeSupabase, recalcular,
  } = useAppStore()

  const cot = cotizaciones[cotizacionId]
  const p = cot?.propiedad
  const pie = cot?.pie
  const hip = cot?.hipotecario
  const uf = global.uf_valor_clp

  const [modoManual, setModoManual] = useState(cot?.modo_fuente === 'manual')
  const { proyectos, loading: loadingProys } = useProyectos()
  const [proyectoSelId, setProyectoSelId] = useState<string>('')
  const { unidades, loading: loadingUnidades } = useUnidades(proyectoSelId)

  // Recalcular al cambiar parámetros
  useEffect(() => {
    if (cot?.activa) recalcular()
  }, [cot?.propiedad, cot?.pie, cot?.hipotecario, cot?.rentabilidad, uf])

  const handleModoSwitch = (manual: boolean) => {
    setModoManual(manual)
    setModoFuente(cotizacionId, manual ? 'manual' : 'supabase')
  }

  const handleCargarUnidad = (unidadId: string) => {
    const unidad = unidades.find(u => u.id === unidadId)
    const proyecto = proyectos.find(pr => pr.id === proyectoSelId)
    if (!unidad || !proyecto) return

    const prop: DatosPropiedad = {
      proyecto_nombre: proyecto.nombre,
      proyecto_comuna: proyecto.comuna,
      proyecto_barrio: proyecto.barrio ?? '',
      proyecto_direccion: proyecto.direccion ?? '',
      unidad_numero: unidad.numero,
      unidad_tipologia: unidad.tipologia,
      unidad_sup_interior_m2: unidad.sup_interior_m2,
      unidad_sup_terraza_m2: unidad.sup_terraza_m2,
      unidad_sup_total_m2: unidad.sup_total_m2,
      unidad_orientacion: unidad.orientacion,
      unidad_entrega: unidad.entrega,
      precio_lista_uf: unidad.precio_lista_uf,
      descuento_uf: unidad.descuento_uf,
      precio_compra_uf: unidad.precio_compra_uf,
      bono_descuento_pct: unidad.bono_descuento_pct,
      bono_max_pct: unidad.bono_max_pct,
      estacionamiento_uf: unidad.estacionamiento_uf,
      bodega_uf: unidad.bodega_uf,
      reserva_clp: 100_000,
    }
    cargarDesdeSupabase(cotizacionId, prop)
  }

  if (!cot) return null

  // Resultados calculados
  const res = cot.activa
    ? calcularResultadosCotizacion(cot, uf)
    : null

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
              <select className="form-select"
                onChange={(e) => handleCargarUnidad(e.target.value)}
                disabled={!proyectoSelId || loadingUnidades}>
                <option value="">— Seleccionar unidad —</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.numero} · {u.tipologia} · {u.sup_total_m2}m² · {formatUF(u.precio_lista_uf)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Datos de la propiedad (manual o pre-cargado) ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏢 Datos de la Unidad</h3>
          {cot.activa && <span className="badge badge-green">✓ Activa</span>}
        </div>
        <div className="card-grid-3">
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
        </div>

        <div className="card-grid-3" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">Precio Lista (UF)</label>
            <FormattedNumberInput className="form-input" value={p.precio_lista_uf}
              readOnly={!modoManual} decimals={2}
              onChange={(val) => setPropiedad(cotizacionId, { precio_lista_uf: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Descuento (UF)</label>
            <FormattedNumberInput className="form-input" value={p.descuento_uf}
              readOnly={!modoManual} decimals={2}
              onChange={(val) => setPropiedad(cotizacionId, { descuento_uf: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Precio Compra (UF)</label>
            <FormattedNumberInput className="form-input"
              value={modoManual ? p.precio_compra_uf : p.precio_lista_uf - p.descuento_uf}
              readOnly={!modoManual} decimals={2}
              onChange={(val) => setPropiedad(cotizacionId, { precio_compra_uf: val })} />
          </div>

          {/* ── Bonos comerciales (en %) ── */}
          <div className="form-group">
            <label className="form-label">Descuento adicional (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100}
                value={p.bono_descuento_pct * 100}
                readOnly={!modoManual} decimals={2}
                onChange={(val) => setPropiedad(cotizacionId, { bono_descuento_pct: val / 100 } as Partial<DatosPropiedad>)}
                style={{ opacity: modoManual ? 1 : 0.7, width: '100%' }} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Bono pie máximo (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100}
                value={p.bono_max_pct * 100}
                readOnly={!modoManual} decimals={2}
                onChange={(val) => setPropiedad(cotizacionId, { bono_max_pct: val / 100 } as Partial<DatosPropiedad>)}
                style={{ opacity: modoManual ? 1 : 0.7, width: '100%' }} />
              <span className="suffix">%</span>
            </div>
          </div>

          {/* ── Pie y desglose ── */}
          <div className="form-group">
            <label className="form-label">Pie total (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100}
                value={pie.pie_pct * 100} decimals={2}
                onChange={(val) => setPie(cotizacionId, { pie_pct: val / 100 })} style={{width: '100%'}} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Upfront / Abono inicial (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100}
                value={pie.upfront_pct * 100} decimals={2}
                onChange={(val) => setPie(cotizacionId, { upfront_pct: val / 100 })} style={{width: '100%'}} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Cuotas antes entrega (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100}
                value={pie.cuotas_antes_entrega_pct * 100} decimals={2}
                onChange={(val) => setPie(cotizacionId, { cuotas_antes_entrega_pct: val / 100 })} style={{width: '100%'}} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">N° cuotas antes entrega</label>
            <FormattedNumberInput min={0} max={120} className="form-input"
              value={pie.cuotas_antes_entrega_n} decimals={0}
              onChange={(val) => setPie(cotizacionId, { cuotas_antes_entrega_n: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Cuotas después entrega (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={0} max={100}
                value={pie.cuotas_despues_entrega_pct * 100} decimals={2}
                onChange={(val) => setPie(cotizacionId, { cuotas_despues_entrega_pct: val / 100 })} style={{width: '100%'}} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">N° cuotas después entrega</label>
            <FormattedNumberInput min={0} max={120} className="form-input"
              value={pie.cuotas_despues_entrega_n} decimals={0}
              onChange={(val) => setPie(cotizacionId, { cuotas_despues_entrega_n: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">N° cuotas totales pie</label>
            <FormattedNumberInput min={0} max={120} className="form-input" value={pie.pie_n_cuotas_total} decimals={0}
              onChange={(val) => setPie(cotizacionId, { pie_n_cuotas_total: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Reserva ($)</label>
            <FormattedNumberInput className="form-input" value={p.reserva_clp} decimals={0}
              onChange={(val) => setPropiedad(cotizacionId, { reserva_clp: val })} />
          </div>
        </div>
      </div>

      {/* ── Parámetros hipotecarios ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏦 Crédito Hipotecario</h3>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sistema Francés + seguros</span>
        </div>
        <div className="card-grid-3">
          <div className="form-group">
            <label className="form-label">Tasa Anual (%)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={1} max={20}
                value={hip.hipotecario_tasa_anual * 100} decimals={2}
                onChange={(val) => setHipotecario(cotizacionId, { hipotecario_tasa_anual: val / 100 })} style={{width: '100%'}} />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Plazo (años)</label>
            <div className="form-input-group">
              <FormattedNumberInput min={5} max={30}
                value={hip.hipotecario_plazo_anos} decimals={0}
                onChange={(val) => setHipotecario(cotizacionId, { hipotecario_plazo_anos: val })} style={{width: '100%'}} />
              <span className="suffix">años</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">% Financiamiento</label>
            <div className="form-input-group">
              <FormattedNumberInput min={50} max={100}
                value={hip.hipotecario_aprobacion_pct * 100} decimals={2}
                onChange={(val) => setHipotecario(cotizacionId, { hipotecario_aprobacion_pct: val / 100 })} style={{width: '100%'}} />
              <span className="suffix">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Rentabilidad (Renta Larga / Corta) ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏘️ Rentabilidad</h3>
          {/* Selector mutuamente excluyente */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
            {(['larga', 'corta'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setRentabilidad(cotizacionId, { tipo_renta: tipo })}
                style={{
                  padding: '6px 16px', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: cot.rentabilidad.tipo_renta === tipo
                    ? tipo === 'larga' ? 'var(--color-accent)' : 'var(--color-gold)'
                    : 'transparent',
                  color: cot.rentabilidad.tipo_renta === tipo
                    ? tipo === 'larga' ? '#fff' : '#0a0e1a'
                    : 'var(--color-text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {tipo === 'larga' ? '🏠 Renta Larga' : '📱 Renta Corta'}
              </button>
            ))}
          </div>
        </div>

        <div className="card-grid-3">
          {/* Plusvalía — siempre visible */}
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

          {cot.rentabilidad.tipo_renta === 'larga' ? (
            /* RENTA LARGA: un solo input de arriendo neto */
            <div className="form-group">
              <label className="form-label">Arriendo mensual neto ($)</label>
              <FormattedNumberInput min={0} className="form-input"
                placeholder="$CLP neto mensual" decimals={0}
                value={cot.rentabilidad.arriendo_mensual_clp || 0}
                onChange={(val) => setRentabilidad(cotizacionId, { arriendo_mensual_clp: val })} />
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 3, display: 'block' }}>
                Ingresa el valor neto, ya descontados corretaje y vacancia
              </span>
            </div>
          ) : (
            /* RENTA CORTA: desglose bruto → neto */
            <>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div style={{ padding: '8px 12px', background: 'rgba(212,168,67,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-muted)', borderLeft: '3px solid var(--color-gold)' }}>
                  💡 Ingresa el ingreso bruto mensual que calculaste desde tu fuente de datos (Gemini, scrapping, etc.). El neto se calcula automáticamente.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Ingreso bruto mensual ($)</label>
                <FormattedNumberInput min={0} className="form-input"
                  placeholder="$CLP bruto por mes" decimals={0}
                  value={cot.rentabilidad.airbnb_ingreso_bruto_clp || 0}
                  onChange={(val) => setRentabilidad(cotizacionId, { airbnb_ingreso_bruto_clp: val })} />
              </div>
              <div className="form-group">
                <label className="form-label">Comisión plataforma (%)</label>
                <div className="form-input-group">
                  <FormattedNumberInput min={0} max={100}
                    value={cot.rentabilidad.airbnb_admin_pct * 100} decimals={2}
                    onChange={(val) => setRentabilidad(cotizacionId, { airbnb_admin_pct: val / 100 })} style={{width: '100%'}} />
                  <span className="suffix">%</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Gastos comunes ($)</label>
                <FormattedNumberInput min={0} className="form-input" decimals={0}
                  value={cot.rentabilidad.gastos_comunes_clp || 0}
                  onChange={(val) => setRentabilidad(cotizacionId, { gastos_comunes_clp: val })} />
              </div>

              {/* Ref informativa */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  Tarifa por noche ($) <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>REF</span>
                </label>
                <FormattedNumberInput min={0} className="form-input" style={{ opacity: 0.7 }} decimals={0}
                  value={cot.rentabilidad.airbnb_valor_dia_clp || 0}
                  onChange={(val) => setRentabilidad(cotizacionId, { airbnb_valor_dia_clp: val })} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  Ocupación mensual (%) <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>REF</span>
                </label>
                <div className="form-input-group">
                  <FormattedNumberInput min={0} max={100} style={{ opacity: 0.7, width: '100%' }} decimals={2}
                    value={cot.rentabilidad.airbnb_ocupacion_pct * 100}
                    onChange={(val) => setRentabilidad(cotizacionId, { airbnb_ocupacion_pct: val / 100 })} />
                  <span className="suffix">%</span>
                </div>
              </div>

              {/* Neto calculado automáticamente */}
              {cot.rentabilidad.airbnb_ingreso_bruto_clp > 0 && (() => {
                const admin = Math.round(cot.rentabilidad.airbnb_ingreso_bruto_clp * cot.rentabilidad.airbnb_admin_pct)
                const neto = cot.rentabilidad.airbnb_ingreso_bruto_clp - admin - cot.rentabilidad.gastos_comunes_clp
                return (
                  <div style={{ gridColumn: '1 / -1', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Bruto</div><div style={{ fontWeight: 700 }}>{formatCLP(cot.rentabilidad.airbnb_ingreso_bruto_clp)}</div></div>
                    <span style={{ color: 'var(--color-text-muted)' }}>−</span>
                    <div style={{ color: 'var(--color-error)' }}><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Admin</div><div style={{ fontWeight: 700 }}>{formatCLP(admin)}</div></div>
                    <span style={{ color: 'var(--color-text-muted)' }}>−</span>
                    <div style={{ color: 'var(--color-error)' }}><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>G. Comunes</div><div style={{ fontWeight: 700 }}>{formatCLP(cot.rentabilidad.gastos_comunes_clp)}</div></div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 18, marginLeft: 'auto', marginRight: 8 }}>=</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#10b981' }}>Neto al flujo</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#10b981' }}>{formatCLP(neto)}</div>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {/* ── Resultados ── */}
      {res && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Resultado</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div className="stat-item">
              <span className="stat-label">Precio Compra</span>
              <span className="stat-value gold">{formatUF(res.hipotecario.monto_credito_uf / hip.hipotecario_aprobacion_pct)}</span>
              <span className="stat-sub">{formatCLP((res.hipotecario.monto_credito_uf / hip.hipotecario_aprobacion_pct) * uf)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Monto Escrituración</span>
              <span className="stat-value">{formatUF(res.escrituracion_uf)}</span>
              <span className="stat-sub">{formatCLP(res.escrituracion_uf * uf)}</span>
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
