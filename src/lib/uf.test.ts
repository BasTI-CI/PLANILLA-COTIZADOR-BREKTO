import { afterEach, describe, expect, it, vi } from 'vitest'
import { cargarUF, type ResultadoUF } from './uf'

const FECHA = '2026-10-17T03:00:00.000Z'

function respuesta(body: unknown): Response {
  return { json: async () => body } as Response
}

/** fetch que responde `body`, o rechaza con AbortError si lo abortan antes. */
function fetchQueResponde(body: unknown, demoraMs = 0): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(respuesta(body)), demoraMs)
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new DOMException('aborted', 'AbortError'))
      })
    })) as typeof fetch
}

/** fetch que nunca responde: solo termina si lo abortan. */
const fetchColgado: typeof fetch = ((_url: string, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')))
  })) as typeof fetch

const OK_BODY = { serie: [{ valor: 41173.33, fecha: FECHA }] }

afterEach(() => {
  vi.useRealTimers()
})

describe('cargarUF', () => {
  it('éxito → ok: true con valor y fecha, una sola vez', async () => {
    vi.useFakeTimers()
    const on = vi.fn<(r: ResultadoUF) => void>()
    cargarUF(on, fetchQueResponde(OK_BODY))
    await vi.runAllTimersAsync()
    expect(on).toHaveBeenCalledTimes(1)
    expect(on).toHaveBeenCalledWith({ ok: true, valor: 41173.33, fechaISO: FECHA })
  })

  it('doble montaje StrictMode → un solo resultado, ok: true', async () => {
    vi.useFakeTimers()
    const on = vi.fn<(r: ResultadoUF) => void>()
    const fetchFn = fetchQueResponde(OK_BODY, 500)
    const cleanup1 = cargarUF(on, fetchFn)
    cleanup1()
    cargarUF(on, fetchFn)
    await vi.runAllTimersAsync()
    expect(on).toHaveBeenCalledTimes(1)
    expect(on).toHaveBeenCalledWith({ ok: true, valor: 41173.33, fechaISO: FECHA })
    expect(on).not.toHaveBeenCalledWith({ ok: false })
  })

  it('cleanup antes de la respuesta → nunca llama a onResultado', async () => {
    vi.useFakeTimers()
    const on = vi.fn<(r: ResultadoUF) => void>()
    const cleanup = cargarUF(on, fetchQueResponde(OK_BODY, 500))
    cleanup()
    await vi.runAllTimersAsync()
    expect(on).not.toHaveBeenCalled()
  })

  it('timeout propio → ok: false', async () => {
    vi.useFakeTimers()
    const on = vi.fn<(r: ResultadoUF) => void>()
    cargarUF(on, fetchColgado, 6000)
    await vi.advanceTimersByTimeAsync(5999)
    expect(on).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(on).toHaveBeenCalledTimes(1)
    expect(on).toHaveBeenCalledWith({ ok: false })
  })

  it('error de red → ok: false', async () => {
    const on = vi.fn<(r: ResultadoUF) => void>()
    const fetchFn = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch
    cargarUF(on, fetchFn)
    await vi.waitFor(() => expect(on).toHaveBeenCalledTimes(1))
    expect(on).toHaveBeenCalledWith({ ok: false })
  })

  it.each([
    ['sin serie', {}],
    ['serie vacía', { serie: [] }],
    ['valor 0', { serie: [{ valor: 0, fecha: FECHA }] }],
  ])('payload inválido (%s) → ok: false', async (_nombre, body) => {
    vi.useFakeTimers()
    const on = vi.fn<(r: ResultadoUF) => void>()
    cargarUF(on, fetchQueResponde(body))
    await vi.runAllTimersAsync()
    expect(on).toHaveBeenCalledTimes(1)
    expect(on).toHaveBeenCalledWith({ ok: false })
  })
})
