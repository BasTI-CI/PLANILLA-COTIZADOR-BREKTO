/**
 * Reparte ítems de alto conocido (secciones o filas, en px) en hojas, sin partir ninguno (B-10).
 *
 * - Llena la hoja actual mientras la suma quepa en `disponible` y no pase de `maxPorHoja` ítems;
 *   el ítem que no cabe abre hoja nueva. Conserva el orden: nunca adelanta un ítem a una hoja anterior.
 * - Un ítem más alto que `disponible` va solo en su hoja (no se parte; la guardia del PDF lo avisa).
 *
 * Devuelve los índices de cada hoja. Lista vacía → [].
 */
export function repartirEnHojas(alturas: number[], disponible: number, maxPorHoja = Infinity): number[][] {
  const hojas: number[][] = []
  let actual: number[] = []
  let usado = 0
  alturas.forEach((alto, i) => {
    if (actual.length > 0 && (usado + alto > disponible || actual.length >= maxPorHoja)) {
      hojas.push(actual)
      actual = []
      usado = 0
    }
    actual.push(i)
    usado += alto
  })
  if (actual.length > 0) hojas.push(actual)
  return hojas
}
