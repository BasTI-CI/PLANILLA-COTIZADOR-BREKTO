import { useAppStore } from '@/store/useAppStore'
import SimuladorHipotecario from './SimuladorHipotecario'

export default function ModuloHipotecario() {
  const { cotizaciones, cotizacion_activa_idx, setCotizacionActiva } = useAppStore()

  return (
    <div>
      <div className="cotizacion-tabs">
        {cotizaciones.map((cot, idx) => (
          <button
            key={cot.id}
            className={`cotizacion-tab ${cotizacion_activa_idx === idx ? 'active' : ''}`}
            onClick={() => setCotizacionActiva(idx)}
          >
            Cotización {String.fromCharCode(65 + idx)}
            {cot.activa && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>✓</span>}
          </button>
        ))}
      </div>

      <SimuladorHipotecario key={cotizacion_activa_idx} cotizacionId={cotizacion_activa_idx} />
    </div>
  )
}
