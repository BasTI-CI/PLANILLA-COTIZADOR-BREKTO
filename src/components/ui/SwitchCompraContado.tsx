interface Props {
  /** true = compra contado (perilla a la derecha, 💰); false = con crédito (izquierda, 🏦). */
  contado: boolean
  onChange: (contado: boolean) => void
}

const ANCHO = 60
const ALTO = 30
const PERILLA = 24

/** B-04: switch crédito hipotecario ↔ compra contado. Espacio y Enter funcionan por ser un button. */
export default function SwitchCompraContado({ contado, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={contado}
      aria-label="Compra contado"
      title={contado ? 'Compra contado: pago único del 100 %' : 'Con crédito hipotecario'}
      className="switch-compra-contado"
      onClick={() => onChange(!contado)}
      style={{
        position: 'relative',
        flexShrink: 0,
        width: ANCHO,
        height: ALTO,
        padding: 0,
        borderRadius: ALTO / 2,
        border: '1px solid var(--color-border)',
        background: contado ? 'var(--color-gold)' : 'var(--color-surface-alt)',
        cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <span aria-hidden style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 13, lineHeight: 1 }}>
        🏦
      </span>
      <span aria-hidden style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 13, lineHeight: 1 }}>
        💰
      </span>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: (ALTO - 2 - PERILLA) / 2,
          left: contado ? ANCHO - 2 - PERILLA - 2 : 2,
          width: PERILLA,
          height: PERILLA,
          borderRadius: '50%',
          background: 'var(--color-text-primary)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}
