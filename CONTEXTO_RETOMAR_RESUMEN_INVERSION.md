# Contexto para retomar — Resumen de Inversión (guardado a propósito)

Este archivo resume el **prompt acordado** y la **interpretación del asistente** para continuar el trabajo en otro día desde el mismo computador, sin depender solo del historial del chat.

---

## Estado acordado del producto

- **COTIZACIÓN:** OK (no tocar).
- **SIMULADOR:** OK (no tocar).
- **RESUMEN DE INVERSIÓN:** pendiente de los cambios detallados abajo.

---

## I. Prompt original — Comparativa de cotizaciones (Resumen de Inversión)

- Renombrar **Precio Neto** → **PRECIO DE COMPRA**.
- **PRECIO DE COMPRA:** todos los precios con descuento (depto, est, bod), **sin bono pie**. Es el precio real que el cliente paga a la inmobiliaria. (La definición ya fue discutida y detallada en el código; si hace falta, re-detallar con la fórmula explícita.)
- **PIE A PAGAR:** pie a documentar − bono pie.
- Incluir **Bono pie** en la comparativa.
- El resto de la sección: **perfecto** (mantener).

---

## II. Prompt original — Gráficos

- **Eliminar** el gráfico de **Estructura** (irrelevante).
- Quedan **solo tres** gráficos:

### 1. Plusvalía y patrimonio

- **Año 0:** todo el patrimonio que el cliente está comprando, **sin el bono pie**.
- **Entre año 0 y año 1:** pendiente más inclinada (positiva) porque la plusvalía en ese tramo debe ser: **bono pie + plusvalía**.
- **Entre año 1 y año 5:** solo plusvalía anual, pendiente **constante**.

### 2. Diversificación de fondos

- Aplica **solo si** existe la tabla de **Flujo de caja a 60 meses**.
- Horizonte **60 meses** (mes 0 al 60 incluidos).
- Incluye, entre otros: costos de escrituración, devolución de IVA, pago de cuotas pie (antes y después de entrega), diversificación en instrumento tipo depósito a plazo (tasa fija mensual), capacidad de ahorro mensual, diferencia arriendo − dividendo.

### 3. Resultado financiero total

- Igual que el gráfico **2**, más el punto de **utilidad de venta** de los departamentos al **quinto año**.

**Orden de pestañas (conceptual):** el **Resumen de Inversión** debe ser una pestaña **posterior** a **Flujo de caja**, porque muchos parámetros del gráfico 2 vienen de esa pestaña.

**Referencia:** planilla de cálculo base y PDF exportado usados para generar el programa.

**Nota explícita del usuario:** primero resolver esto; **después** el Flujo de caja (donde hay definiciones pendientes). Pregunta abierta: ¿se puede hacer Resumen sin cerrar Flujo antes?

---

## Interpretación del asistente (resumen)

| Parte | Acción |
|--------|--------|
| Comparativa | Renombrar etiquetas/valores según definiciones; alinear **Precio de compra** al criterio “con descuentos, sin bono pie”; **Pie a pagar** y fila/columna **Bono pie** visibles y coherentes. |
| Gráfico Estructura | Quitar por completo. |
| Gráfico 1 | Curva patrimonio/plusvalía con reglas de tramos año 0 → 1 → 5. |
| Gráficos 2 y 3 | Dependen de **serie de flujo 60 meses** + venta año 5 en el (3). |
| Orden UI | Resumen después de Flujo de caja cuando la app tenga pestañas en ese orden. |

---

## Respuesta a: ¿Flujo de caja primero o se puede Resumen sin eso?

- **Comparativa + gráfico 1 + quitar Estructura:** en principio **sí** pueden avanzar con datos ya disponibles en Cotización/Simulador (y fórmulas ya documentadas en código).
- **Gráficos 2 y 3:** implementación **completa** cuando exista la **tabla/lógica de flujo a 60 meses**; antes se puede maquetar UI y ocultar o condicionar esos gráficos.

---

## Próximos pasos sugeridos (cuando retomes)

1. **Definiciones fijas de variables (cotización / comparativa):** ver **`variables_calculo.md` §1.0** — en **§1.0.0** está la diferenciación **precio lista / precio de compra / valor tasación / valor escrituración** e impacto por pestaña; en **§1.0.1** siguen **PRECIO DE COMPRA**, **Bono pie**, **PIE A PAGAR** y el mapa **función ↔ variables**; el código y la UI deben alinearse a ese documento.
2. Localizar en el código la pestaña/sección **Resumen de Inversión**, comparativa y componentes de gráficos.
3. Aplicar cambios de **I** y **II.1** + eliminar **Estructura**.
4. Implementar o conectar **II.2** y **II.3** según exista o no el módulo de Flujo de caja a 60 meses.

---

## Cómo encontrar esto mañana

- Abre este repo en Cursor y el archivo: **`CONTEXTO_RETOMAR_RESUMEN_INVERSION.md`** (raíz del proyecto).
- Opcional: añade el archivo al commit cuando quieras que quede en GitHub.

---

*Generado para retomar trabajo sin perder el hilo del prompt y la interpretación acordada.*
