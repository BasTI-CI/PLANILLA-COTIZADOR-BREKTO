// ─── UF del día (API Mindicador.cl) ────────────────────────────────
// Lógica pura del fetch, separada de useUF para poder testear el doble
// montaje de StrictMode sin jsdom (B-09).

export const UF_URL = 'https://mindicador.cl/api/uf'

export type ResultadoUF =
  | { ok: true; valor: number; fechaISO?: string }
  | { ok: false }

/**
 * Pide la UF del día y llama a `onResultado` una sola vez.
 * Devuelve el cleanup: cancela el fetch y, desde ese momento, `onResultado`
 * ya no se llama. El timeout propio sí cuenta como fallo (`ok: false`);
 * solo la cancelación por cleanup se ignora.
 */
export function cargarUF(
  onResultado: (r: ResultadoUF) => void,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 6000,
): () => void {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let cancelado = false

  const entregar = (r: ResultadoUF) => {
    if (!cancelado) onResultado(r)
  }

  async function fetchUF() {
    try {
      const res = await fetchFn(UF_URL, { signal: controller.signal })
      const data = await res.json()
      const valor: number | undefined = data?.serie?.[0]?.valor
      const fechaISO: string | undefined = data?.serie?.[0]?.fecha
      if (valor && valor > 0) entregar({ ok: true, valor, fechaISO })
      else entregar({ ok: false })
    } catch {
      entregar({ ok: false })       // timeout, red o CORS → fallback
    } finally {
      clearTimeout(timeout)
    }
  }
  void fetchUF()

  return () => {
    cancelado = true
    controller.abort()
    clearTimeout(timeout)
  }
}
