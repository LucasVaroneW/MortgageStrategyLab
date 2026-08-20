# Mortgage Strategy Lab

Herramienta personal, **local** y **offline** para analizar estrategias de financiación inmobiliaria.

## ¿Qué es?

Un comparador de **estrategias completas** de compra de vivienda, no de productos aislados. La unidad de análisis es una **operación**: una vivienda concreta + una hipoteca concreta + cero o más préstamos personales + una cantidad de ahorros aportados.

Ejemplos de preguntas que responde:

- ¿Me conviene más una hipoteca al 3% financiando el 90% y pedir un préstamo personal para la entrada, o una hipoteca al 4% financiando el 95%?
- ¿Una combinación mucho más cara durante los primeros 10 años puede terminar siendo más barata a 30 años?
- ¿Cuánto dinero necesito realmente para comprar esta vivienda?
- ¿Qué pasa con mi patrimonio a 5, 10, 20 y 30 años?
- ¿Cuándo se compensa el coste adicional de pedir un préstamo personal?
- ¿A qué **TAE máxima** del préstamo personal sigue siendo viable una estrategia concreta?

## Documentación completa

Para entender el código, extenderlo, o agregar hipotecas, lee **[DOCS.md](./DOCS.md)**.

DOCS.md incluye:
- Arquitectura detallada y modelo de datos.
- Cómo funciona el motor financiero (amortización francesa, TIN vs TAE, etc.).
- **Workflows paso a paso** para que un agente IA pueda:
  - Agregar una hipoteca desde un PDF.
  - Investigar discrepancias en cálculos.
  - Añadir nuevos campos, métricas o pestañas.
- Convenciones de código y glosario financiero.

## Filosofía del software

- **Datos introducidos** / **cálculos** / **estimaciones** / **supuestos**: siempre separados y etiquetados.
- **Nunca** asume inflación, crecimiento salarial o revalorización de la vivienda como hecho: son hipótesis marcadas como tales.
- **Nunca** inventa ofertas bancarias.
- **Nunca** confunde TAE con TIN. Las cuotas se calculan con TIN; la TAE se muestra como métrica informativa.
- **Nunca** afirma que una estrategia es "segura" o "la mejor". Muestra cifras y comparaciones; las decisiones las tomas tú.

## Estado del proyecto

- **FASE 1 (funcional)**: perfil, propiedades, ofertas hipotecarias, préstamos personales, estrategias, comparador, persistencia local, import/export JSON, motor matemático verificado, tests.
- **FASE 2–4**: pendientes (generador automático de combinaciones, rankings, inflación, salario, valor vivienda, patrimonio, gráficos, sensibilidad, robustez, UX avanzado, importador de PDF para ofertas).

## Cómo arrancar

Tienes **3 opciones**, de más fácil a más customizable:

### Opción 1: Doble clic en `start.bat` ← LA MÁS FÁCIL (Windows)

Si tienes **Node.js** o **Python** instalado:

1. Doble clic en **`start.bat`**.
2. Se abre automáticamente el navegador en `http://localhost:8765/`.
3. Cuando quieras parar el servidor, ejecuta **`stop.bat`**.

Si no tienes Node ni Python, descárgalos de [nodejs.org](https://nodejs.org) (recomendado).

### Opción 2: Ejecutable standalone `MortgageStrategyLab.exe` ← SIN INSTALAR NADA

Si ya generaste el `.exe` (ver instrucciones de build más abajo):

1. Doble clic en **`dist/MortgageStrategyLab.exe`** o en **`dist/start.bat`**.
2. Se abre el navegador en `http://localhost:8765/`.
3. Para parar: ejecutar **`dist/stop.bat`** o cerrar la ventana.

**No requiere Node.js ni Python instalado**. Es un único `.exe` de ~36 MB que contiene Node 18 + la app.

### Opción 3: Docker ← PORTABLE ENTRE MÁQUINAS

```bash
docker compose up -d        # arrancar
docker compose down         # parar
docker compose logs -f      # ver logs
```

Luego abre `http://localhost:8000/`.

---

### Datos persistentes (en todas las opciones)

- Todo se guarda automáticamente en **IndexedDB** del navegador.
- Si cierras el navegador, los datos siguen ahí al volver a abrir la app.
- Puedes **exportar a JSON** en la pestaña "Datos" y guardar el archivo donde quieras (por ejemplo `hipotecas_agosto_2026.json`).
- Puedes **importar desde JSON** para fusionar o reemplazar.

## Estructura del proyecto

```
MortgageStrategyLab/
├── index.html              UI principal (incluye favicon)
├── tests.html              Página de tests (en navegador)
├── server.cjs              Servidor HTTP estático (CommonJS para pkg)
├── start.bat               Launcher Windows modo dev (Node.js)
├── start-dev.bat           Launcher modo desarrollo
├── stop.bat                Detiene el servidor (cualquier modo)
├── debug.bat               Arranca el servidor en primer plano (logs visibles)
├── package.json            Config npm + scripts
├── Dockerfile              Imagen Docker
├── docker-compose.yml      Orquestación Docker
├── build-icons.mjs         Genera .ico y PNGs desde icon.svg
├── build-exe.mjs           Empaqueta como .exe standalone (Windows/Linux/macOS)
├── pkg.config.json         Config de pkg (assets a incluir)
├── assets/                 Iconos y assets
│   ├── icon.svg            SVG maestro
│   ├── icon.ico            Multi-resolución para Windows
│   ├── favicon-16.png      ...
│   ├── favicon-32.png      ...
│   ├── favicon-48.png      ...
│   ├── favicon-64.png      ...
│   ├── favicon-128.png     ...
│   └── favicon-256.png     ...
├── styles/                 Estilos
│   ├── main.css
│   └── favicon.svg
├── src/
│   ├── core/               Utilidades: dinero, validación, ids
│   ├── finance/            Motor financiero puro (testable)
│   │   ├── loan.js         Amortización francesa genérica
│   │   ├── mortgage.js     Hipoteca (fija, variable, mixta)
│   │   ├── personalLoan.js Préstamo personal
│   │   ├── initialCost.js  Coste inicial y dinero necesario
│   │   ├── strategy.js     Análisis de estrategia completa
│   │   ├── breakeven.js    Punto de equilibrio entre dos estrategias
│   │   ├── taeMax.js       TAE máxima admisible
│   │   └── rankings.js     Rankings múltiples + personalizado
│   ├── model/              Modelo de datos y factories
│   ├── storage/            IndexedDB e import/export JSON
│   ├── ui/                 Interfaz (DOM puro, sin frameworks)
│   │   ├── dom.js          Helpers para construir DOM
│   │   ├── state.js        Estado global
│   │   ├── charts.js       Graficos SVG nativos (sin dependencias)
│   │   ├── app.js          Punto de entrada
│   │   └── tabs/           Una pestaña = un archivo
│   └── tests/              Tests automatizados (31 casos)
├── dist/                   Salida del build (contiene el .exe)
└── data/                   Carpeta vacía (futuras exportaciones)
```

## Modelo de datos (JSON)

El archivo exportado tiene esta estructura:

```json
{
  "version": 1,
  "exportedAt": "2026-08-20T...",
  "perfiles":          [ ... ],
  "propiedades":       [ ... ],
  "ofertasHipoteca":   [ ... ],
  "prestamosPersonales":[ ... ],
  "estrategias":       [ ... ],
  "supuestos":         { "inflacionAnual": 2.0, ... },
  "configuracionRanking": { "pesos": { ... } }
}
```

Ver `src/model/factories.js` para los campos exactos de cada entidad.

## Tests

```bash
npm test
```

31 tests verifican:

- Cuotas correctas para varios casos (150k al 2% a 30 años, 133k al 4%, 150k al 5% a 25 años, 7k al 8% a 7 años).
- Amortización: el saldo final cuadra exactamente a 0, la suma del principal = principal inicial.
- Hipotecas fijas, variables y mixtas (cambio de TIN tras los años fijos).
- Cálculo del importe según % y base (precio / tasación / menor).
- Coste inicial en modo MANUAL y ESTIMADO.
- Detección de liquidez insuficiente.
- Análisis completo de las estrategias A, B y C del ejemplo real.
- Punto de equilibrio entre dos estrategias.
- TAE máxima admisible de un préstamo personal.
- **Integridad del JSON exportado**.
- **Gráficos**: formateo de magnitudes, ticks, alineación de series.
- **Rankings**: múltiples rankings consistentes, patrimonio final, personalizado con pesos.

También puedes abrir **`tests.html`** en el navegador para ver los tests en formato visual (incluye validación visual de los gráficos SVG).

## Construir el `.exe` standalone

```bash
npm install                # solo la primera vez
npm run build:icons        # genera icon.ico y PNGs desde assets/icon.svg
npm run build:exe          # genera el .exe para Windows con icono
npm run build:exe -- --all # genera para Windows, Linux y macOS
npm run build:all          # icons + exe (atajo)
```

Requisitos para el build: **Node.js 18 o 20** instalado en la máquina donde construyas (no en la máquina destino).

El `.exe` resultante:
- **Tiene icono personalizado** (la casita con gráfico de tendencia).
- **NO abre ventana de consola** al hacer doble clic (se ejecuta oculto).
- **Abre el navegador automáticamente** en `http://localhost:8765/`.
- Es portable: puedes copiarlo a cualquier PC Windows y arrancarlo sin instalar nada.

## Filosofía de "fácil de crecer"

- **Cero dependencias de runtime**. Todo es JavaScript puro y APIs del navegador.
  - Gráficos: SVG nativo (`src/ui/charts.js`).
  - Persistencia: IndexedDB (API del navegador).
  - UI: DOM puro con helpers pequeños.
- **Una pestaña = un archivo** en `src/ui/tabs/`. Añadir una pestaña = un archivo + una entrada en `app.js`.
- **Cada módulo del motor financiero** es puro (sin DOM, sin estado global) y se puede probar aisladamente con `npm test`.
- **Convenciones claras**: factories con valores por defecto en `src/model/factories.js`, validaciones en `src/core/validation.js`.
- **Sin código muerto**: cada archivo tiene una responsabilidad clara y se elimina si deja de usarse.

## Ejemplo real de validación

Vivienda 140.000 €, ahorros 10.000 €, colchón 2.000 €.

| Estrategia | Hipoteca | Préstamo | Dinero hoy | Cuota inicial | Coste total |
|---|---|---|---|---|---|
| A (95% al 4%) | 133.000 € | 10.000 € al 8% / 7a | 7.250 € | 790,82 € | 241.679 € |
| B (90% al 2,7%) | 126.000 € | 20.000 € al 8% / 10a | 4.250 € | 753,71 € | 213.098 € |
| C (100% al 4,5%) | 140.000 € | — | 10.250 € | 709,36 € | 255.369 € |

**A 30 años gana la estrategia B** (la más barata), aunque requiere un préstamo personal mayor.
**Por cuota inicial** gana C (no tiene préstamo personal).
**Por dinero necesario hoy** gana B (4.250 €).

El motor de la aplicación reproduce exactamente estos números.

## Próximas fases (no implementadas aún)

- **FASE 2**: generador automático de combinaciones, rankings múltiples, análisis primeros 10 años.
- **FASE 3**: inflación, salario, valor vivienda, patrimonio, coste real, sensibilidad.
- **FASE 4**: gráficos, análisis de robustez, UX avanzado, importador de PDF para ofertas, tests E2E.

## Licencia

Uso personal. El usuario es dueño de todos los datos que introduce.
