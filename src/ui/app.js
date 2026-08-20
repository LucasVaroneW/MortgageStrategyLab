// Punto de entrada de la UI.
// Inicializa estado, monta listeners de tabs y arranca.

import { state } from './state.js';
import { renderTabPerfil } from './tabs/perfil.js';
import { renderTabPropiedades } from './tabs/propiedades.js';
import { renderTabHipotecas } from './tabs/mortgageOffers.js';
import { renderTabPersonales } from './tabs/personalLoans.js';
import { renderTabEstrategias } from './tabs/strategies.js';
import { renderTabComparador } from './tabs/comparator.js';
import { renderTabDatos } from './tabs/dataIO.js';
import { renderTabDashboard } from './tabs/dashboard.js';
import { renderTabGraficos } from './tabs/graficos.js';
import { renderTabRankings } from './tabs/rankings.js';
import { abrirDB } from '../storage/db.js';
import { el } from './dom.js';

const TABS = {
  dashboard: { label: 'Resumen', render: renderTabDashboard },
  perfil: { label: 'Perfil', render: renderTabPerfil },
  propiedades: { label: 'Propiedades', render: renderTabPropiedades },
  hipotecas: { label: 'Ofertas hipoteca', render: renderTabHipotecas },
  personales: { label: 'Préstamos personales', render: renderTabPersonales },
  estrategias: { label: 'Estrategias', render: renderTabEstrategias },
  comparador: { label: 'Comparador', render: renderTabComparador },
  graficos: { label: 'Gráficos', render: renderTabGraficos },
  rankings: { label: 'Rankings', render: renderTabRankings },
  datos: { label: 'Datos', render: renderTabDatos },
};

let activeTab = 'dashboard';

async function init() {
  const status = document.getElementById('db-status');
  try {
    await abrirDB();
    await state.init();
    status.textContent = 'Base de datos: conectada';
    status.style.color = 'var(--good)';
  } catch (e) {
    status.textContent = 'Base de datos: ERROR · ' + e.message;
    status.style.color = 'var(--bad)';
    console.error(e);
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      mountTabs();
    });
  });

  mountTabs();

  state.subscribe(() => {
    if (activeTab === 'dashboard' || activeTab === 'comparador') {
      mountTabs();
    }
  });
}

function mountTabs() {
  const main = document.getElementById('app-main');
  while (main.firstChild) main.removeChild(main.firstChild);
  const renderer = TABS[activeTab];
  if (!renderer) {
    main.appendChild(el('p', {}, ['Pestaña desconocida.']));
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
  main.appendChild(renderer.render());
}

init();
