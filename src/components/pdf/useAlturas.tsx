import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Altos medidos en px. `clave` → alto del nodo `[data-medir="clave"]`; `clave#i` → alto de la fila i
 *  de `tbody > tr` dentro de `[data-medir-filas="clave"]`. */
export type Alturas = Record<string, number>

function leerAlturas(cont: HTMLElement): Alturas {
  const out: Alturas = {}
  cont.querySelectorAll<HTMLElement>('[data-medir]').forEach((n) => {
    out[n.dataset.medir as string] = n.getBoundingClientRect().height
  })
  cont.querySelectorAll<HTMLElement>('[data-medir-filas]').forEach((n) => {
    const clave = n.dataset.medirFilas as string
    n.querySelectorAll('tbody > tr').forEach((tr, i) => {
      out[`${clave}#${i}`] = tr.getBoundingClientRect().height
    })
  })
  return out
}

function iguales(a: Alturas, b: Alturas): boolean {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => k in b && Math.abs(a[k] - b[k]) < 0.5)
}

/**
 * Mide los nodos marcados dentro del contenedor de medición (B-10). Re-mide tras cada render, al
 * terminar de cargar las fuentes y cuando el contenedor cambia de tamaño. Solo actualiza el estado
 * si algún alto cambió: lo medido no depende del reparto, así que no hay bucle.
 */
export function useAlturas() {
  const ref = useRef<HTMLDivElement>(null)
  const [alturas, setAlturas] = useState<Alturas>({})

  const medir = useCallback(() => {
    if (!ref.current) return
    const next = leerAlturas(ref.current)
    setAlturas((prev) => (iguales(prev, next) ? prev : next))
  }, [])

  useLayoutEffect(() => {
    medir()
  })

  useEffect(() => {
    let vivo = true
    document.fonts?.ready.then(() => {
      if (vivo) medir()
    })
    const ro = new ResizeObserver(() => medir())
    if (ref.current) ro.observe(ref.current)
    return () => {
      vivo = false
      ro.disconnect()
    }
  }, [medir])

  const alto = (clave: string) => alturas[clave] ?? 0
  /** Altos de las `n` filas de una tabla medida con `data-medir-filas`. */
  const filas = (clave: string, n: number) => Array.from({ length: n }, (_, i) => alto(`${clave}#${i}`))

  return { ref, alto, filas }
}

/** Espera fuentes cargadas + 2 frames, para capturar la hoja con el reparto ya estable. */
export async function esperarLayoutEstable(): Promise<void> {
  await document.fonts?.ready
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** Estilo del contenedor de medición: fuera de vista, invisible, sin afectar el layout. */
export const MEDICION_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: -99999,
  top: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
}

/**
 * Envoltorio de cada sección, igual en la medición y en la hoja. `flow-root` deja dentro de la medida
 * los márgenes de sus hijos (no colapsan con la sección vecina), así la suma de altos es exacta.
 */
export function Bloque({ medir, filas, children }: {
  /** Clave del alto medido (data-medir). */
  medir?: string
  /** Clave para medir cada `tbody > tr` (data-medir-filas). */
  filas?: string
  children: React.ReactNode
}) {
  return (
    <div data-medir={medir} data-medir-filas={filas} style={{ display: 'flow-root' }}>
      {children}
    </div>
  )
}
