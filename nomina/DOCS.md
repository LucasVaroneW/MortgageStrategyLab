# Nómina — formato de datos e importación

`nomina/nomina.html` es una mini-app autocontenida (HTML+CSS+JS en un solo
archivo, sin dependencias) para repartir una nómina entre gastos fijos,
compartidos con otra persona, y ocio. Vive embebida como pestaña dentro de
Mortgage Strategy Lab (`src/ui/tabs/nomina.js` la carga en un `<iframe>`),
pero **su almacenamiento es independiente**: usa `localStorage` con claves
`nom_*`, no la IndexedDB del resto de la app.

Este documento explica el formato de datos para que **una IA (u otra
persona) pueda generar un JSON de importación** a partir de información
dada por el usuario, sin tener que releer todo `nomina.html` desde cero.

## Modelo mental

Hay dos "personas" (modo `a` y modo `b`) que comparten algunos gastos y
tienen otros propios. Cada persona tiene:
- Su nómina neta y gastos fijos personales (inglés, ahorro, viajes, acciones).
- Su lista de "gastos propios" (suscripciones, etc.).
- Sus propias cuentas bancarias y saldos.
- Sus propios "pasos" mensuales (transferencias entre sus cuentas, con una
  fórmula de qué variables sumar para calcular el monto).

Lo compartido (sueldos de ambos, conceptos como alquiler/comida, y a quién
le toca pagar qué % según su sueldo) vive en un tercer bloque `shared`.

## Formato del JSON de importación

```json
{
  "version": 1,
  "shared": {
    "sueldoA": 0,
    "sueldoB": 0,
    "conceptos": [
      { "id": "alquiler", "name": "Alquiler", "amount": 0 },
      { "id": "comida", "name": "Comida", "amount": 0 }
    ],
    "comidaConceptoId": "comida"
  },
  "a": { "...": "ver campos abajo" },
  "b": { "...": "ver campos abajo" }
}
```

Los bloques `a` y `b` tienen exactamente los mismos campos:

| Campo | Tipo | Significado |
|---|---|---|
| `nomina` | number | Nómina neta mensual de esa persona. |
| `ingles` | number | Gasto fijo en clases de inglés (o similar). |
| `acciones` | number | Aporte fijo a inversión/acciones. |
| `ahorro` | number | Aporte fijo a ahorro. |
| `viajesFijo` | number | Aporte fijo mensual reservado para viajes. |
| `compraComida` | number | Importe de la compra de supermercado del mes. |
| `propios` | `{name, amount}[]` | Gastos propios (suscripciones, etc.). |
| `extras` | `{name, amount}[]` | Gastos puntuales del mes (se resetean manualmente). Normalmente `[]` al importar. |
| `banks` | `{id, name, role}[]` | Cuentas bancarias de esa persona. `id` es un slug corto (ej. `bbva`, `tr`) usado por `saldos` y por `steps.from`/`steps.to`. |
| `saldos` | `{[bankId]: number}` | Saldo actual de cada cuenta. Debe tener una clave por cada `id` en `banks`. Normalmente arranca todo en `0`. |
| `steps` | `{name, from, to, formula}[]` | Pasos mensuales (transferencias). `from`/`to` son `id`s de `banks` (o `null`). `formula` es un array de nombres de variable (ver abajo) que se **suman** para calcular el monto del paso. |
| `stepsDone` | `boolean[]` | Un valor por cada elemento de `steps`, en el mismo orden. Normalmente todo `false` al importar (mes sin empezar). |

### Variables disponibles para `formula`

`nomina`, `ocio`, `acciones`, `propios` (suma total), `ingles`, `ahorro`,
`viajesFijo`, `viajesTotal`, `miAporteCompartidos`, `miAporteSinComida`,
`comidaCompra`, `psicologo` (busca en `propios` un ítem cuyo nombre
contenga "psic"), `youtube` (busca un ítem que contenga "youtube").

## Cómo generar este JSON (instrucciones para una IA)

1. Pedile al usuario (o buscá en el archivo local que tenga, si te lo pasó)
   los valores reales: sueldos, alquiler/comida, gastos propios de cada
   persona, bancos que usa cada quien y los pasos/transferencias que hace
   cada mes.
2. Armá el JSON siguiendo **exactamente** el esquema de arriba. Los campos
   que el usuario no te dé, dejalos en su valor neutro: `0` para números,
   `[]` para listas, `{}` para `saldos` (o con cada banco en `0`).
3. Los `id` de `banks` pueden ser cualquier slug corto sin espacios
   (`bbva`, `cuenta1`, etc.) — lo importante es que los mismos `id` se usen
   consistentemente en `saldos` y en `steps.from`/`steps.to`.
4. No hace falta mandar el archivo completo si el usuario solo quiere
   actualizar una persona: se puede mandar solo `{"version":1, "a": {...}}`
   y el resto queda como está (la importación **fusiona** por bloque:
   pisa `shared`, `a` y `b` como bloques completos si vienen en el JSON,
   pero no toca el bloque que no venga).
5. Entregale al usuario el JSON en un bloque de código para que lo pegue
   directamente en la pestaña **Nómina → Datos → "Importar pegando el
   texto"** (o lo guarde como `.json` y use "Importar desde archivo").

## Dónde vive todo esto en el código

- Estado y helpers de storage: `reloadState()`, `load()`/`save()` (por
  persona), `loadShared()`/`saveShared()` (compartido), todo dentro del
  único `<script>` de `nomina/nomina.html`.
- Exportar: `exportarDatos()` arma este mismo JSON leyendo `localStorage`
  con `snapshotModo('a')` / `snapshotModo('b')`.
- Importar: `importarDatos(data)` escribe cada campo con `saveFor(m, key,
  val)` / `saveShared(key, val)`, después llama a `reloadState()` y
  `renderAll()`.
- Ejemplo real de un JSON completo generado a partir de datos reales:
  buscá en el historial de conversación con la IA, o pedile a la IA que
  te regenere uno nuevo siguiendo esta guía.

**Importante:** el JSON con datos reales (nombres, bancos, sueldos) nunca
debe commitearse a este repo, que es público. Generalo aparte y
guardalo/pegalo solo en tu navegador.
