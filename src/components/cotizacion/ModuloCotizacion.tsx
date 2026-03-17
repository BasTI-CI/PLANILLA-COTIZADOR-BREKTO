import { useAppStore } from '@/store/useAppStore'
import CotizacionForm from './CotizacionForm'

export default function ModuloCotizacion() {
  const {
    cotizaciones, cotizacion_activa_idx,
    setCotizacionActiva, agregarCotizacion, eliminarCotizacion,
  } = useAppStore()

  return (
    <div>
      {/* ── Tabs de cotizaciones ── */}
      <div className="cotizacion-tabs">
        {cotizaciones.map((cot, idx) => (
          <button
            key={cot.id}
            className={`cotizacion-tab ${cotizacion_activa_idx === idx ? 'active' : ''}`}
            onClick={() => setCotizacionActiva(idx)}
          >
            Cotización {String.fromCharCode(65 + idx)} {/* A, B, C, D */}
            {cot.activa && (
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>
                ✓ {cot.propiedad.proyecto_nombre?.split(' ')[0]}
              </span>
            )}
          </button>
        ))}

        {cotizaciones.length < 4 && (
          <button className="btn-add-cotizacion" onClick={agregarCotizacion}>
            + Agregar cotización
          </button>
        )}

        {cotizaciones.length > 1 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto', color: 'var(--color-error)' }}
            onClick={() => eliminarCotizacion(cotizacion_activa_idx)}
          >
            🗑 Eliminar
          </button>
        )}
      </div>

      {/* ── Formulario de cotización activa ── */}
      <CotizacionForm key={cotizacion_activa_idx} cotizacionId={cotizacion_activa_idx} />
    </div>
  )
}
