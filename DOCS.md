# Mortgage Strategy Lab — Documentación técnica

> **Para quién es este documento.** Un agente IA (o un humano nuevo) que recibe el código y debe ser productivo sin hacer 100 preguntas. Léelo en orden la primera vez; luego úsalo como referencia.

---

## Índice

0. **TL;DR** — resumen de 30 segundos.
1. **Qué es esto (y qué no es)** — propósito, filosofía, lo que NO hace.
2. **Arquitectura general** — capas, dependencias, principios.
3. **Modelo de datos** — esquema JSON completo, entidades, validaciones.
4. **Motor financiero** — amortización, hipoteca, estrategia, equilibrio, TAE máx, rankings.
5. **Interfaz** — estructura, cómo añadir pestañas y campos.
6. **Persistencia** — IndexedDB, import/export JSON.
7. **Gráficos** — motor SVG nativo, cómo añadir.
8. **Build y distribución** — pipeline, comandos, `pkg.config.json`.
9. **Testing** — estructura, cómo añadir tests.
10. **GUÍA PARA AGENTES IA** — workflows paso a paso.
11. **Convenciones de código** — estilo, estructura, tests, comentarios.
12. **Glosario** — TIN, TAE, Euríbor, etc.

---

## 0. TL;DR (30 segundos)

- **Qué es:** una app web local (sin servidor, sin base de datos externa) para comparar estrategias de financiación inmobiliaria: una hipoteca + cero o más préstamos personales + unos ahorros.
- **Stack:** JavaScript puro. Sin React, sin frameworks. Un servidor estático (`server.cjs`) sirve HTML + módulos ES6. Persistencia en IndexedDB.
- **Estructura:** `src/finance/` (motor), `src/ui/` (interfaz), `src/model/` (datos), `src/storage/` (persistencia), `src/tests/` (tests). Un solo build genera `MortgageStrategyLab.exe` (~36 MB) con icono Windows.
- **Comandos clave:** `npm test` (corre 31 tests), `npm run build:exe` (genera `.exe` con icono), `start.bat` (lanza el `.exe`).
- **Reglas de oro:**
  1. Las cuotas se calculan con **TIN**, nunca con TAE.
  2. La TAE es **informativa** (viene del banco); no se calcula.
  3. La inflación, el crecimiento de vivienda y el crecimiento salarial son **supuestos del usuario**, no predicciones.
  4. No hay backend. No hay scraping. No hay APIs.

---

## 1. Qué es esto (y qué no es)

### 1.1 El problema

Comprar una vivienda tiene estas decisiones:

1. **¿Cuánto financia el banco?** (% de financiación: 80%, 90%, 95%, 100%…)
2. **¿Qué hipoteca?** (tipo fijo/variable/mixta, TIN, vinculaciones, comisiones)
3. **¿Préstamo personal para cubrir la entrada?** (TAE, plazo)
4. **¿Cuánto de mis ahorros uso hoy?** (vs. cuánto colchón dejo)
5. **¿Qué plazo?**

Las decisiones están acopladas. Una hipoteca al 95% evita un préstamo personal, pero tiene peor TIN. Una al 80% con préstamo personal al 8% puede ser más barata a 30 años pero más cara a 5.

Esta herramienta modela la operación completa: vivienda + hipoteca + préstamos + ahorro, calcula mes a mes cuánto pagas, cuánto debes, cuánto patrimonio tienes, y compara variantes.

### 1.2 Lo que NO es

- **No es un comparador de hipotecas**. El producto no importa: lo que importa es la operación completa.
- **No scrapea bancos**. Los datos los introduces tú (o un agente que lea PDFs).
- **No predice el Euríbor**. Los tipos variables se calculan con el valor vigente; el análisis de sensibilidad (FASE 3) es lo que explora escenarios.
- **No afirma qué es "mejor"**. Muestra rankings configurables; la decisión es tuya.
- **No tiene backend**. Todo vive en tu navegador.

### 1.3 Filosofía de transparencia

Cada valor se etiqueta con su naturaleza:
- **[MANUAL]**: dato introducido por el usuario.
- **[ESTIMADO]**: calculado por un heurístico (ej. gastos como % del precio).
- **[CALCULADO]**: derivado matemáticamente.
- **[SUPUESTO]**: hipótesis (inflación, revalorización).

Nunca se mezcla un cálculo con una estimación sin marcarlo. Ver `src/ui/tabs/propiedades.js` y `src/finance/initialCost.js`.

---

## 2. Arquitectura general

```
┌────────────────────────────────────────────────────────────┐
│                         UI (DOM)                            │
│   index.html  +  styles/main.css  +  src/ui/             │
│   ├── app.js          (orquestador)                        │
│   ├── state.js        (estado global + suscripciones)      │
│   ├── dom.js          (helpers para construir DOM)         │
│   ├── charts.js       (motor SVG de gráficos)              │
│   └── tabs/           (una pestaña = un archivo)           │
├────────────────────────────────────────────────────────────┤
│              Motor financiero puro (testable)              │
│   src/finance/                                           │
│   ├── loan.js          Amortización francesa              │
│   ├── mortgage.js      Hipoteca (fija/variable/mixta)     │
│   ├── personalLoan.js  Préstamo personal                   │
│   ├── initialCost.js   Coste inicial + dinero necesario    │
│   ├── strategy.js      Estrategia completa (hipo + pers.)  │
│   ├── breakeven.js     Punto de equilibrio                 │
│   ├── taeMax.js        TAE máxima admisible                │
│   └── rankings.js      Rankings múltiples                  │
├────────────────────────────────────────────────────────────┤
│                Modelo de datos                             │
│   src/model/factories.js                                  │
│   (factories con valores por defecto + esquema JSON v1)   │
├────────────────────────────────────────────────────────────┤
│                Persistencia local                          │
│   src/storage/                                           │
│   ├── db.js          IndexedDB wrapper                    │
│   └── jsonIO.js      Import/export JSON                   │
├────────────────────────────────────────────────────────────┤
│                Servidor estático                           │
│   server.cjs       (CommonJS para compatibilidad con pkg) │
├────────────────────────────────────────────────────────────┤
│                Build / Distribución                        │
│   build-icons.mjs   (SVG → PNG + .ico)                    │
│   build-exe.mjs     (pkg → .exe)                          │
│   postbuild-exe.mjs (resedit → icono + WINDOWS_GUI)      │
│   pkg.config.json   (qué assets empaquetar)               │
└────────────────────────────────────────────────────────────┘
```

### 2.1 Principios arquitectónicos

1. **El motor es puro.** Ningún módulo en `src/finance/` importa nada de `src/ui/` o `src/storage/`. Reciben datos, devuelven datos. Esto los hace fáciles de testear con `npm test`.

2. **Una pestaña = un archivo.** Añadir una pestaña nueva es un solo archivo en `src/ui/tabs/` + una línea en `src/ui/app.js`.

3. **El estado vive en un solo lugar.** `src/ui/state.js` mantiene arrays de cada entidad. Cada cambio se persiste en IndexedDB y se emite a los listeners.

4. **Cero dependencias de runtime.** Solo `pkg` y `sharp` para el build (no se incluyen en el bundle final). El usuario descarga un `.exe` con Node embebido.

5. **CommonJS para el servidor.** El resto del código es ES modules. La razón: `pkg` no soporta ES modules como entry point, y `server.cjs` necesita ser el entry point empaquetable.

---

## 3. Modelo de datos

### 3.1 Esquema JSON v1

El JSON exportado tiene esta forma:

```json
{
  "version": 1,
  "exportedAt": "2026-08-20T12:00:00Z",
  "perfiles":          [ Perfil, ... ],
  "propiedades":       [ Propiedad, ... ],
  "ofertasHipoteca":   [ OfertaHipoteca, ... ],
  "prestamosPersonales":[ PrestamoPersonal, ... ],
  "estrategias":       [ Estrategia, ... ],
  "supuestos":         { inflacionAnual, crecimientoVivienda, ... },
  "configuracionRanking": { pesos: { ... } }
}
```

Los factories en `src/model/factories.js` son la fuente de verdad para la forma de cada entidad (qué campos tiene, qué defaults).

### 3.2 Entidades

#### Perfil (`nuevoPerfil()`)
Tu situación personal. Una por persona o familia.

```
id                 UUID
nombre             string  ("Perfil principal")
edad               int     [16-100]
comunidadAutonoma  string
provincia          string
municipio          string
primeraVivienda    bool
viviendaHabitual   bool
ingresosNetosMensuales number (€)
ingresosNetosAnuales    number (€)
crecimientoSalarialAnualEsperado number (% anual, ej. 2.0)
ahorrosDisponibles  number (€)
colchonMinimo       number (€)  — mínimo a conservar tras la compra
otrosPrestamos      array   (no usado en FASE 1)
cuotasMensualesExistentes  number (€)
cuotaMaximaDeseada  number (€)  — límite de cuota
plazoMaximoDeseado  int     (años)
plazoPreferido      int     (años)
```

#### Propiedad (`nuevaPropiedad()`)
Una vivienda concreta que estás valorando.

```
id                 UUID
nombre             string
precio             number (€)
ubicacion          string
comunidadAutonoma  string
provincia          string
municipio          string
nueva              bool    (obra nueva / primera transmisión vs usada)
valorTasacion      number | null (€)  — null = usar precio
gastosCompra:
  modo             "MANUAL" | "ESTIMADO"
  impuestos        number (€)
  notaria          number (€)
  registro         number (€)
  gestoria         number (€)
  tasacion         number (€)
  otros            number (€)
  porcentajeEstimado number (%)  — solo si modo = "ESTIMADO"
```

#### OfertaHipoteca (`nuevaOfertaHipoteca()`)
Una hipoteca concreta que te ofrece un banco.

```
id                 UUID
banco              string  (obligatorio)
producto           string  (obligatorio)
fecha              ISO date
estado             "activa" | "en_estudio" | "aceptada" | "descartada"
notas              string

financiacion:
  porcentajeMaximo number (%)  [0-200]
  importeMaximo    number | null (€)
  importeSolicitado number | null (€)  — sustituye al cálculo por %
  baseCalculo      "precio" | "tasacion" | "menor"

tipo               "fija" | "variable" | "mixta"

# Solo si tipo = "fija"
fija:
  tin              number (%)
  tae              number (%)

# Solo si tipo = "variable"
variable:
  euribor          number (%)
  diferencial      number (%)
  tinInicial       number (%)  — informativo
  tae              number (%)
  frecuenciaRevision "anual" | "semestral" | "trimestral"

# Solo si tipo = "mixta"
mixta:
  aniosTramoFijo   int
  tinTramoFijo     number (%)
  tae              number (%)
  tramoVariable:
    euribor        number (%)
    diferencial    number (%)

plazo:
  anios            int
  meses            int      (= anios * 12)

vinculaciones      array de { tipo, obligatoria, costeMensual, costeAnual, bonificacion, notas }
                   (informativo, no afecta a cálculos en FASE 1)

comisiones:
  apertura         number (%)        — % sobre principal
  aperturaFija     number (€)
  amortizacionParcial  number (%)
  amortizacionTotal    number (%)
  amortizacionDuranteAnios  int | null
```

#### PrestamoPersonal (`nuevoPrestamoPersonal()`)
Un préstamo personal (no hipoteca).

```
id                 UUID
nombre             string (obligatorio)
importe            number (€)
tin                number (%)  [0-30]   — el motor calcula cuotas con TIN
tae                number (%)  [0-30]   — informativo
plazoAnios         int
plazoMeses         int       (= plazoAnios * 12)
comisionApertura   number (%)          — % sobre principal
comisionAperturaFija number (€)
otrosCostes        number (€)
```

#### Estrategia (`nuevaEstrategia()`)
Una operación completa: una vivienda + una hipoteca + N préstamos + una cantidad de ahorros.

```
id                 UUID
nombre             string
perfilId           UUID | null  — perfil asociado para esfuerzo/ingresos
propiedadId        UUID         (obligatorio)
hipotecaId         UUID         (obligatorio)
prestamosIds       UUID[]       (0..N préstamos personales)
aportacionAhorros:
  modo             "AUTO" | "MANUAL"
  importe          number (€)
  ahorrosRestantes number (€)
  cumpleColchon    bool
  alertaLiquidez   bool
notas              string
```

#### Supuestos (`supuestosPorDefecto()`)
Hipótesis globales que se aplican a todas las estrategias.

```
inflacionAnual         number (%)  — ej. 2.0
crecimientoVivienda    number (%)  — ej. 2.0
crecimientoSalario     number (%)  — ej. 2.0
euriborProyectado      number (%)  — para simulaciones futuras
```

#### ConfiguracionRanking (`configuracionRankingPorDefecto()`)
Pesos para el ranking "Mejor para mi situación".

```
pesos:
  costeTotal        number (%) [0-100]
  liquidezInicial   number (%) [0-100]
  cuotaInicial      number (%) [0-100]
  patrimonioFinal   number (%) [0-100]
  esfuerzoIngresos  number (%) [0-100]
  # (la suma debe ser 100; se normaliza internamente)
```

### 3.3 Validación

`src/core/validation.js` valida cada entidad antes de persistir. Reglas:
- Edades entre 16-100
- TIN/TAE entre 0-30%
- Porcentaje de financiación entre 0-200%
- Meses > 0
- Plazos < 50 años

Si la validación falla, la UI muestra los errores en un panel rojo.

---

## 4. Motor financiero

### 4.1 Amortización francesa (`src/finance/loan.js`)

Es la base de TODO. Tanto hipotecas como préstamos personales usan este motor.

**Fórmula de la cuota:**

```
cuota = P · i · (1+i)^n / ((1+i)^n - 1)

donde:
  P = principal (€)
  i = TIN mensual (TIN anual / 100 / 12)
  n = número de meses
```

**Desarrollo mes a mes:**

```
saldo_0 = P
para cada mes k = 1..n:
  interes_k   = saldo_{k-1} · i
  principal_k  = cuota - interes_k
  saldo_k      = saldo_{k-1} - principal_k

último mes: ajustar principal_k para liquidar saldo exactamente.
```

**Precisión:** todos los cálculos intermedios en céntimos (`Math.round(saldo_cents * i)`), solo se redondean a 2 decimales al presentar. Esto evita derivas de coma flotante.

**API:**

```js
import { amortizar, calcCuota } from './loan.js';

const r = amortizar({
  principal: 133000,
  tinAnualPct: 4,
  meses: 360,
  comisionAperturaPct: 0,
  comisionAperturaFija: 0,
  nombre: 'BBVA 95%',
});
// r.cuota            = 634.96
// r.totalPagado      = 228585.6
// r.totalIntereses   = 95585.6
// r.totalPrincipal   = 133000
// r.totalComisiones  = 0
// r.tablaMensual     = [{ mes, anio, fecha, cuota, interes, principal, saldo, comision }, ...]
// r.resumenAnual     = [{ anio, cuotaTotal, intereses, principal, comision, saldoFinal, meses }, ...]
```

### 4.2 Hipoteca (`src/finance/mortgage.js`)

Wrapper sobre `loan.js` con tres responsabilidades:

1. **Calcular el importe financiado** según el % y la base (precio/tasación/menor).
2. **Determinar el TIN efectivo** según el tipo:
   - **Fija:** TIN constante durante toda la vida.
   - **Variable:** TIN = Euríbor + diferencial (constante en FASE 1; FASE 3 lo simulará).
   - **Mixta:** TIN fijo durante `aniosTramoFijo`, luego Euríbor + diferencial.
3. **Soportar cambios de TIN** dentro del plazo (solo para mixtas).

**API principal:**

```js
import { amortizarHipoteca, calcularImporteHipoteca, tinEnMes } from './mortgage.js';

const importe = calcularImporteHipoteca(propiedad, oferta);
// 133000 si baseCalculo = 'precio' y % = 95% y precio = 140000

const tin = tinEnMes(oferta, 1);
// 4 si es fija al 4%
// 4 si es mixta y mes 1 <= aniosTramoFijo * 12
// 3 si es mixta y mes > aniosTramoFijo * 12 (Euríbor 2.5 + diferencial 0.5)

const r = amortizarHipoteca(propiedad, oferta);
// r.tablaMensual con cambios de TIN si es mixta
```

**Decisiones de diseño:**

- Las hipotecas mixtas usan `amortizarConCambioTIN()` (interno) que divide el plazo en tramos y recalcula la cuota al inicio de cada uno. Esto es más realista que asumir un TIN constante durante toda la vida.
- Las comisiones de apertura se aplican como un único cargo extra al mes 1 (no se reparten).

### 4.3 Préstamo personal (`src/finance/personalLoan.js`)

Wrapper simple. Sin variación de TIN (siempre fijo durante toda la vida).

### 4.4 Coste inicial (`src/finance/initialCost.js`)

Calcula el dinero que necesitas el día de la firma:

```
coste_inicial_total = precio + gastos_compra
aportacion_propia_necesaria = max(0, coste_inicial_total - hipoteca - prestamos + comision_apertura)

ahorro_restante = ahorros_disponibles - aportacion_propia_necesaria
alerta_liquidez = ahorro_restante < colchon_minimo
```

La `aportacion_propia_necesaria` se calcula siempre, incluso si los préstamos + hipoteca cubren el coste. Esto permite ver si la operación es financieramente viable.

### 4.5 Estrategia completa (`src/finance/strategy.js`)

Combina:
- 1 hipoteca
- 0..N préstamos personales
- 1 aportación de ahorros

Genera una **tabla consolidada mes a mes** sumando los flujos de todas las deudas:

```js
const a = analizarEstrategia({
  propiedad,
  hipoteca,
  prestamos: [p1, p2],
  perfil,  // opcional, para esfuerzo sobre ingresos
});
// a.tablaConsolidada   = [{ mes, anio, fecha, cuotaHipoteca, cuotaPrestamos,
//                          cuotaTotal, interesHipoteca, interesPrestamos,
//                          interesTotal, principalHipoteca, principalPrestamos,
//                          principalTotal, comision, saldoHipoteca,
//                          saldoPrestamos, saldoTotal, prestamosActivos }, ...]
// a.resumenAnual       = resumen agregado por año
// a.totales            = { totalPagado, totalIntereses, totalPrincipal,
//                          totalComisiones, cuotaInicial, cuotaDespuesPrestamos,
//                          meses }
```

**Detalle importante: cuota después de préstamos personales.** Cuando todos los préstamos personales terminan, la cuota cae. Esta métrica (`cuotaDespuesPrestamos`) se calcula buscando el primer mes en que todos los préstamos han llegado a su plazo.

### 4.6 Punto de equilibrio (`src/finance/breakeven.js`)

Compara dos estrategias mes a mes:

```
acumuladoA_mes_k = suma de cuotaTotal de A hasta el mes k
acumuladoB_mes_k = suma de cuotaTotal de B hasta el mes k

cruce = primer mes k donde (acumuladoB - acumuladoA) cambia de signo
       (típicamente: A es más cara al principio, B la alcanza, luego A gana)
```

Si no hay cruce, una estrategia siempre es mejor que la otra.

### 4.7 TAE máxima (`src/finance/taeMax.js`)

Dadas dos estrategias:
- **A** (referencia, sin préstamo personal)
- **B** (alternativa, con préstamo personal)

Encuentra la TAE máxima del préstamo personal para que el coste total de B iguale al de A.

**Método:** bisección numérica en el rango [0, 50]%.

**Interpretación:**
- Si la TAE máxima está entre 4-12%: la estrategia es viable con condiciones de mercado normales.
- Si está por debajo de 4%: la estrategia solo compensa con condiciones muy favorables (raras).
- Si está por encima de 12%: la estrategia no compensa con préstamos personales estándar.

### 4.8 Rankings (`src/finance/rankings.js`)

7 rankings predefinidos + 1 personalizable.

**Predefinidos:**
1. `porCosteTotal` — menor totalPagado gana
2. `porLiquidezInicial` — menor dineroNecesario gana
3. `porCuotaInicial` — menor cuotaInicial gana
4. `porCuotaTrasPrestamos` — menor cuotaDespuesPrestamos gana
5. `porIntereses` — menor totalIntereses gana
6. `porEsfuerzoIngresos` — menor (cuotaInicial / ingresosNetosMensuales) gana
7. `porPatrimonioFinal` — mayor (valorViviendaEstimado − saldoFinal) gana

**Personalizado:**

Cada criterio se normaliza a 0-100 (100 = mejor), se pondera con los pesos del usuario y se suma.

```
puntuacion = Σ (peso_i · puntos_i) / Σ pesos_i
```

La fórmula y los pesos son visibles en la UI (no se ocultan).

---

## 5. Interfaz

### 5.1 Estructura

```
src/ui/
├── app.js          # punto de entrada, monta los tabs
├── state.js        # estado global (in-memory + IndexedDB sync)
├── dom.js          # helpers para construir DOM sin frameworks
├── charts.js       # motor de gráficos SVG nativo
└── tabs/           # una pestaña = un archivo
    ├── dashboard.js
    ├── perfil.js
    ├── propiedades.js
    ├── mortgageOffers.js
    ├── personalLoans.js
    ├── strategies.js
    ├── comparator.js
    ├── graficos.js
    ├── rankings.js
    └── dataIO.js
```

### 5.2 Convenciones UI

- **Una pestaña exporta una función `renderTabXxx()`** que devuelve un nodo DOM. Sin estado interno entre renders; si necesita estado, lo guarda en el closure.
- **`el(tag, attrs, children)`** es el helper principal para crear nodos. Atributos se pasan como objeto plano; `class`, `style`, eventos (`onClick`) tienen tratamiento especial.
- **Re-render completo al cambiar estado.** Las pestañas no son "smart components"; cuando cambia el estado, se desmonta y se vuelve a montar. Esto es simple y funciona bien para la escala de esta app.
- **CSS usa variables** (`--accent`, `--good`, etc.) definidas en `:root` en `styles/main.css`. Cambiar el tema = cambiar esas variables.

### 5.3 Cómo añadir una nueva pestaña

1. Crear `src/ui/tabs/nombreTab.js`:

```js
import { el, panel } from '../dom.js';
import { state } from '../state.js';

export function renderTabMiNuevaPestania() {
  const root = el('div', { class: 'tab-content' });
  root.appendChild(el('h2', {}, ['Mi pestaña']));
  // ...
  return root;
}
```

2. Registrar en `src/ui/app.js`:

```js
import { renderTabMiNuevaPestania } from './tabs/nombreTab.js';

const TABS = {
  // ...
  miNuevaPestania: { label: 'Mi pestaña', render: renderTabMiNuevaPestania },
};
```

3. Añadir botón en `index.html`:

```html
<button class="tab-btn" data-tab="miNuevaPestania">Mi pestaña</button>
```

### 5.4 Cómo añadir un campo a un formulario existente

Ejemplo: añadir "IBAN del banco" al perfil.

1. **Modelo** (`src/model/factories.js`): añadir el campo con default al factory `nuevoPerfil()`.
2. **UI** (`src/ui/tabs/perfil.js`): añadir un `formRow({...})` con `inputText({ value: p.iban, onChange: v => update('iban', v) })`.
3. **Tests**: si afecta a cálculos, añadir test en `src/tests/`.
4. **No es necesario** tocar nada en persistencia (IndexedDB acepta cualquier campo).

### 5.5 Cómo añadir un nuevo tipo de hipoteca

Ejemplo: añadir "variable con cap" (techo máximo al TIN).

1. **Modelo** (`src/model/factories.js`): añadir `cap: 0` a la sección `variable` en `nuevaOfertaHipoteca()`.
2. **UI** (`src/ui/tabs/mortgageOffers.js`): añadir input en la sección de tipo variable:
   ```js
   formRow({
     label: 'TIN máximo (cap)',
     control: inputNumber({ value: o.variable.cap, ... }),
   })
   ```
3. **Motor** (`src/finance/mortgage.js`): en `tinEnMes()` o `obtenerTramosMixta()`, aplicar el cap:
   ```js
   const tin = euribor + diferencial;
   return o.variable.cap > 0 ? Math.min(tin, o.variable.cap) : tin;
   ```
4. **Tests** (`src/tests/tests.js`): añadir caso con cap.

---

## 6. Persistencia

### 6.1 IndexedDB (`src/storage/db.js`)

- Una base de datos `MortgageStrategyLabDB` con 6 object stores: `perfiles`, `propiedades`, `ofertasHipoteca`, `prestamosPersonales`, `estrategias`, `configuracion`.
- Cada item tiene `keyPath: 'id'`.
- Operaciones CRUD: `getAll(store)`, `getById(store, id)`, `put(store, item)`, `remove(store, id)`, `clearAll()`.

### 6.2 Estado global (`src/ui/state.js`)

- `state` es un singleton con arrays en memoria para cada entidad.
- `init()` carga desde IndexedDB al arrancar.
- `subscribe(fn)` permite a las pestañas reaccionar a cambios.
- `saveEntity(store, item)` y `deleteEntity(store, id)` persisten + actualizan estado + emiten.

### 6.3 Import/Export JSON (`src/storage/jsonIO.js`)

- `exportarTodo({ supuestos, configuracionRanking, filename })` genera y descarga un `.json`.
- `importarTodo({ mode = 'merge' })` abre un file picker, parsea y fusiona o reemplaza.

**Estructura del JSON** (ver §3.1):

```json
{
  "version": 1,
  "exportedAt": "ISO date",
  "perfiles": [...],
  "propiedades": [...],
  ...
}
```

**Migraciones futuras:** cuando se cambie `version`, escribir un `migrar(data)` que actualice entidades antiguas al nuevo esquema.

---

## 7. Gráficos

### 7.1 Motor (`src/ui/charts.js`)

Motor SVG nativo. Dos clases:
- `LineChart` — líneas + área opcional + puntos opcionales.
- `BarChart` — barras agrupadas (para múltiples series lado a lado).

API:
```js
const chart = createLineChart(container, {
  width: 720,
  height: 320,
  padding: { top: 30, right: 20, bottom: 40, left: 80 },
  xLabel: 'Año',
  yLabel: '€',
  yFormat: v => formatEUR(v),
  xFormat: v => `Año ${v}`,
  showGrid: true,
  showLegend: true,
});

chart.addSeries({
  name: 'Estrategia A',
  color: '#38bdf8',
  data: [{ x: 0, y: 0 }, { x: 1, y: 790.82 }, ...],
  area: true,    // opcional: rellenar hasta y=0
  dashed: false, // opcional: línea discontinua
  points: false, // opcional: mostrar puntos
});

chart.render(); // construye y monta el SVG
```

### 7.2 Por qué SVG nativo

Consideraciones:
- Cero dependencias (vs Chart.js: ~70 KB).
- Control total (colores, animaciones, interactividad).
- Funciona 100% offline siempre.
- Tamaño del módulo: ~280 líneas.

Si en el futuro necesitas features avanzadas (zoom, brush, scatter denso), considera migrar a una librería. Pero para las visualizaciones actuales, SVG nativo es más que suficiente.

### 7.3 Cómo añadir un gráfico

1. En `src/ui/tabs/graficos.js`, añadir función `renderChartXxx(items)`.
2. Llamarla desde `renderTabGraficos()`.
3. Si necesitas un nuevo tipo de gráfico (pie, scatter), añadirlo en `src/ui/charts.js` siguiendo el patrón de `LineChart`/`BarChart`.

---

## 8. Build y distribución

### 8.1 Comandos

```bash
npm test               # 31 tests (motor + integracion + graficos + rankings)
npm run build:icons    # genera PNGs e .ico desde assets/icon.svg
npm run build:exe      # empaqueta el .exe con icono (Windows)
npm run build:all      # icons + exe (atajo)
npm run build:exe -- --all  # también para Linux/macOS
npm run docker:build   # construye imagen Docker
npm run docker:up      # arranca contenedor
```

### 8.2 Pipeline de empaquetado

1. `pkg` toma `server.cjs` (CommonJS) + todos los assets declarados en `pkg.config.json` y genera un `.exe` con Node 18 embebido (~36 MB).
2. `postbuild-exe.mjs` aplica `resedit` sobre el `.exe`:
   - Inyecta `assets/icon.ico` como recurso `RT_ICON_GROUP` con lang=1033 (English US).
   - Cambia el `IMAGE_OPTIONAL_HEADER.Subsystem` de `CONSOLE (2)` a `WINDOWS_GUI (3)`.
3. `build-exe.mjs` también genera `start.bat` (usa PowerShell con `-WindowStyle Hidden`) y `launch-hidden.ps1`.

### 8.3 `pkg.config.json`

Lista los assets que se incluyen en el snapshot. Cuando añadas un nuevo asset, debes listarlo aquí:

```json
{
  "scripts": "server.cjs",
  "assets": [
    "index.html",
    "styles/**/*.css",
    "assets/**/*.ico",
    "src/**/*.js",
    "..."
  ]
}
```

### 8.4 Modo desarrollo

```bash
node server.cjs
# o
start.bat            # Windows
start-dev.bat        # Windows con detección de puerto libre
```

Abre `http://localhost:8765/` (o el puerto que detecte libre).

### 8.5 Cómo añadir un nuevo asset al `.exe`

1. Coloca el archivo en `assets/`, `styles/`, `src/` u otra carpeta listada en `pkg.config.json`.
2. Si es un nuevo tipo de archivo, añade el patrón en `assets` (ej. `data/**/*.json`).
3. Recompila: `npm run build:exe`.

---

## 9. Testing

### 9.1 Estructura

```
src/tests/
├── tests.js                  # 20 tests del motor financiero
├── integrationTests.js       # 3 tests de integración
├── graficosRankingsTests.js  # 8 tests de gráficos y rankings
├── run-tests.mjs             # runner CLI (Node)
└── (más runners si añades)
```

### 9.2 Cómo añadir un test

Cada test es `{ nombre, ejecutar }`. La función `ejecutar()` devuelve `{ ok, errores, detalles }`.

```js
{
  nombre: 'Mi hipoteca al 5% en 25 años da cuota X',
  ejecutar: () => {
    const cuota = calcCuota(150000, 5, 300);
    const ok = casiIgual(cuota, 876.89, 0.05);
    return {
      ok,
      errores: ok ? [] : [`Esperado ~876.89, obtuvo ${cuota}`],
      detalles: { cuotaCalculada: cuota },
    };
  },
}
```

Para añadir el test:
1. Añádelo al array `tests` en `src/tests/tests.js` (o al archivo correspondiente).
2. Si es una categoría nueva, crea un nuevo archivo y añádelo a `run-tests.mjs`.

### 9.3 Cómo ejecutar

- `npm test` — corre todos los tests desde Node.
- Abre `tests.html` en el navegador — corre los tests visualmente.

---

## 10. GUÍA PARA AGENTES IA

Esta sección es la más importante. Está escrita pensando en: "si le doy este DOCS.md + el código a un agente nuevo, debe poder hacer tareas reales sin preguntarme".

### 10.1 Workflow: agregar una hipoteca desde un PDF

**Entrada:** un PDF de ~10 páginas de una hipoteca de un banco.

**Salida esperada:** una nueva entrada en el catálogo `ofertasHipoteca` accesible desde la pestaña "Ofertas hipoteca", con todos los campos rellenos y verificable contra los datos del PDF.

#### Paso 1: extraer los datos del PDF

Usa tu herramienta de extracción de PDF (pypdf, pdfplumber, Adobe API, lo que tengas). Lo que necesitas extraer:

```
Identificación:
  - Banco (cabecera del documento)
  - Producto (nombre comercial)
  - Fecha (fecha del documento o de la oferta)

Financiación:
  - Porcentaje máximo de financiación (ej. "hasta el 80%")
  - Base (normalmente "del menor valor entre precio y tasación")

Tipo y TIN/TAE:
  - Tipo (fija/variable/mixta)
  - Si fija: TIN nominal y TAE
  - Si variable: TIN inicial, Euríbor de referencia, diferencial, frecuencia de revisión
  - Si mixta: años de tramo fijo, TIN fijo, TAE, y datos del tramo variable

Plazo:
  - Máximo (normalmente 30 años)

Vinculaciones (informativo en FASE 1):
  - Nómina, seguros, tarjetas, etc.

Comisiones:
  - Apertura (%, o fija en €)
  - Amortización parcial y total
```

#### Paso 2: validar los datos extraídos

Antes de inyectar nada, verifica:

- **TIN y TAE** están en rango 0-30%. Si el PDF dice "TIN 3.50%" y "TAE 4.12%", la diferencia es coherente (TAE > TIN). Si TAE < TIN, sospecha.
- **Tipo** es uno de `"fija"`, `"variable"`, `"mixta"`. Si el PDF dice "fija con revisión anual", trátalo como `fija`.
- **Porcentaje** está en 0-100% (o 0-200% si permite sobrefinanciar).
- **Si variable:** el TIN = Euríbor + diferencial. Verifica que cuadre.
- **Si mixta:** suma los años de los tramos.

Si algo no cuadra, **no asumas**. Pregunta o marca el campo como `null`.

#### Paso 3: crear el objeto oferta

Usa el factory `nuevaOfertaHipoteca()` de `src/model/factories.js` como punto de partida y rellena solo los campos que apliquen:

```js
import { nuevaOfertaHipoteca } from './model/factories.js';

const nueva = nuevaOfertaHipoteca({
  banco: 'BBVA',
  producto: 'Hipoteca Fija',
  fecha: '2026-08-15',
  estado: 'activa',
  financiacion: {
    porcentajeMaximo: 80,
    baseCalculo: 'menor',
    importeMaximo: null,
    importeSolicitado: null,
  },
  tipo: 'fija',
  fija: {
    tin: 3.50,
    tae: 4.12,
  },
  plazo: {
    anios: 30,
    meses: 360,
  },
  comisiones: {
    apertura: 0.5,
    aperturaFija: 0,
  },
});
```

#### Paso 4: persistir

Usa `saveEntity('ofertasHipoteca', nueva)` de `src/ui/state.js`. Esto guarda en IndexedDB y actualiza el estado en memoria.

#### Paso 5: validar que el cálculo da lo que dice el banco

Compara tu cuota calculada con la cuota de ejemplo del PDF:

```js
import { calcCuota } from './finance/loan.js';
import { calcularImporteHipoteca } from './finance/mortgage.js';

const importe = calcularImporteHipoteca(propiedadEjemplo, nueva);
const cuotaCalculada = calcCuota(importe, nueva.fija.tin, nueva.plazo.meses);
// Comparar con la cuota que muestra el PDF.
```

Si difiere por más de 1 €, probablemente el PDF usa una base diferente (ej. sobre el valor de tasación en vez del precio). Ajusta `baseCalculo` o `porcentajeMaximo` y vuelve a calcular.

#### Paso 6: añadir un test de regresión (opcional pero recomendado)

En `src/tests/tests.js`, añade un test que cree esta hipoteca y verifique la cuota. Si el banco cambia la oferta mañana, este test te avisará.

### 10.2 Workflow: investigar una discrepancia

**Síntomas típicos:**
- "La cuota que calcula la app no coincide con lo que dice el banco."
- "El coste total parece inflado."
- "La estrategia B debería ganar pero A gana."

#### Diagnóstico sistemático:

1. **Reproduce con un test mínimo.** Añade un test en `src/tests/tests.js` que use los mismos números y verifique el resultado esperado. Esto aísla el problema del resto del código.

2. **Verifica la base de cálculo.** El 80% sobre el precio vs. el 80% sobre la tasación (o el menor) puede dar importes muy distintos. Lee el PDF original del banco.

3. **Comprueba las comisiones de apertura.** Si el banco cobra 0,5% de apertura, eso se suma al coste inicial pero NO a la cuota mensual. ¿Lo estás contando en el sitio correcto?

4. **Para mixtas: ¿los tramos están bien?** El motor divide el plazo en tramos con TIN distinto. Si el TIN del segundo tramo está mal, todo lo siguiente está mal.

5. **Para préstamos personales: ¿el TIN es el correcto?** El banco a veces publica el TIN y la TAE por separado. El motor usa el TIN.

6. **¿Hay redondeos ocultos?** El motor trabaja en céntimos internamente. Si en algún sitio se redondea antes de tiempo, los acumulados pueden divergir.

#### Herramientas:

- `npm test` — corre tests para verificar tu hipótesis.
- Añade `console.log` en `src/finance/*.js` (temporalmente) para inspeccionar valores intermedios.
- Compara con la calculadora oficial del banco usando los mismos inputs exactos.

### 10.3 Workflow: añadir un nuevo campo al modelo

Ejemplo: añadir `tipoVivienda` (piso/casa/chalet) a la propiedad.

1. **`src/model/factories.js`:** añadir `tipoVivienda: 'piso'` al factory `nuevaPropiedad()`.

2. **`src/ui/tabs/propiedades.js`:** añadir `formRow` con `inputSelect` en la sección adecuada.

3. **`src/core/validation.js`** (si aplica): añadir regla.

4. **Persistencia:** no requiere cambios (IndexedDB acepta cualquier campo).

5. **Tests:** añadir caso si el campo afecta cálculos.

6. **`pkg.config.json`:** no requiere cambios (los assets no incluyen este archivo).

### 10.4 Workflow: añadir una nueva métrica

Ejemplo: añadir "ratio esfuerzo sobre ingresos en año 5" (no solo en año 1).

1. **`src/finance/strategy.js`:** en `analizarEstrategia()`, calcular la métrica nueva y añadirla a `totales` o `resumenAnual`.

2. **Tests:** añadir caso que verifique el cálculo.

3. **UI:** actualizar la pestaña relevante (Dashboard, Rankings, Estrategias) para mostrar la nueva métrica.

4. **`src/finance/rankings.js`:** si quieres que afecte al ranking personalizado, añadir el criterio a la lista.

### 10.5 Workflow: añadir una pestaña nueva

Ver §5.3. Tres pasos:
1. Crear `src/ui/tabs/nombreTab.js`.
2. Registrar en `src/ui/app.js`.
3. Añadir botón en `index.html`.

### 10.6 Cosas que NUNCA debes hacer

- ❌ **No conectar a APIs externas** (bancos, BOE, etc.). El usuario no quiere eso.
- ❌ **No hacer scraping.** Lee los PDFs a mano (o con tu herramienta de PDF).
- ❌ **No "arreglar" la TAE para que coincida** con un valor que el banco dio. Si difiere, reporta el problema.
- ❌ **No asumir inflación, revalorización o crecimiento salarial** como dato fijo. Son SUPUESTOS del usuario (input).
- ❌ **No borrar tests** que no entiendas. Mejor pregunta.
- ❌ **No mezclar TIN y TAE** en los cálculos. TIN para cuotas, TAE solo informativa.
- ❌ **No añadir dependencias** sin discutirlo antes. La filosofía es cero dependencias de runtime.

---

## 11. Convenciones de código

### 11.1 Estilo

- **Indentación:** 2 espacios.
- **Comillas:** dobles para strings, backticks para template literals.
- **Líneas:** máx. 100 caracteres.
- **Nombres:** `camelCase` para variables/funciones, `PascalCase` para clases/factories, `UPPER_SNAKE` para constantes.

### 11.2 Estructura de archivos

Cada archivo:
- Empieza con un comentario de 1-3 líneas explicando QUÉ es.
- Si tiene dependencias no obvias, las explica.
- Si tiene funciones públicas, las exporta explícitamente.

### 11.3 Tests

Cada test tiene:
- `nombre`: frase descriptiva en lenguaje natural.
- `ejecutar()`: función síncrona o async que devuelve `{ ok, errores, detalles }`.
- `errores`: array de strings explicando qué falló.
- `detalles`: objeto con valores relevantes para diagnóstico.

### 11.4 Comentarios

- "WHY" sobre "WHAT". El código dice qué; los comentarios dicen por qué.
- Si una decisión de diseño no es obvia, lo explica brevemente.
- Sin comentarios obvios (`// incrementa i` sobre `i++`).

---

## 12. Glosario

**TIN (Tipo de Interés Nominal):** porcentaje anual que se aplica al capital pendiente para calcular los intereses. Es el tipo "real" que usa el banco en la fórmula de cuota.

**TAE (Tasa Anual Equivalente):** incluye el TIN más las comisiones y gastos, expresada como porcentaje anual equivalente. Es la "verdadera" medida de coste, pero **no se usa para calcular cuotas**. Solo se muestra como métrica informativa.

**Amortización francesa:** sistema de amortización en el que la cuota mensual es constante durante toda la vida del préstamo, pero la proporción entre intereses y principal varía (al principio más intereses, al final más principal).

**Capital pendiente:** lo que te queda por devolver en un momento dado.

**TIR (Tasa Interna de Retorno):** no confundir con TIN. TIR mide la rentabilidad de una inversión. No se usa en este software directamente.

**Euríbor:** índice de referencia para hipotecas variables en la zona euro. Se publica mensualmente.

**Diferencial:** porcentaje que el banco suma al Euríbor en hipotecas variables. Si Euríbor = 2.5% y diferencial = 0.5%, el TIN variable = 3.0%.

**Comisión de apertura:** porcentaje (o fijo) que se paga al formalizar la hipoteca. Se añade al coste inicial pero no a las cuotas mensuales.

**Comisión de amortización:** lo que cobra el banco si devuelves capital antes del final (amortización parcial o total).

**Vinculaciones:** productos que el banco exige (nómina domiciliada, seguros, tarjetas) a cambio de mejorar el TIN.

**ITP (Impuesto de Transmisiones Patrimoniales):** impuesto que pagas al comprar vivienda usada. Típicamente 6-10% según comunidad autónoma. En vivienda nueva es IVA (10%).

**Gastos de compra:** incluye notaría, registro, gestoría, tasación. Varían pero típicamente son 1-2% del precio.

**Colchón:** dinero que el usuario quiere mantener en su cuenta tras la compra como fondo de emergencia.

**Euríbor + diferencial:** en hipotecas variables, el TIN se recalcula periódicamente (anual, semestral) según esta fórmula.

**Hipoteca mixta:** primeros N años a TIN fijo, luego variable.

**TAE máxima admisible:** la TAE más alta a la que un préstamo personal puede llegar para que una estrategia siga siendo mejor que la alternativa sin préstamo.


