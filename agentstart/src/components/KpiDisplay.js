// AgentStart — KpiDisplay component
//
// Renders the top-line KPI dashboard for a persona: tasks automated,
// hours saved per week, time saved %, and monthly ROI. Every value is rendered in large font via an
// inline style so the sizing holds even when no stylesheet is loaded
// (required by Sub-AC 2c-i).
//
// This is a pure presentational component — it receives a pre-computed KPI
// bundle (from computePersonaKpis in lib/kpi.js) and renders it without
// recomputation. It is independent of any single step so it can be composed
// into Step 2 (analysis dashboard), Step 4 (config summary), or Step 5
// (completion screen) without duplication.
//
// Contract:
//   createKpiDisplay({ kpis, calculationDetails?, document })
//     - kpis:     object from computePersonaKpis (kpi.js). Expected keys:
//                 tasksAutomated, totalTasks, hoursSavedWeekly,
//                 timeSavedPct, roiMonthly
//     - document: DOM-like factory; defaults to global document when present
//   Returns the root element.

const KPI_SPECS = [
  {
    key: 'tasksAutomated',
    label: 'No. of tasks automated',
    format: (v, kpis) => `${v} of ${kpis.totalTasks}`,
    needsKpis: true,
  },
  {
    key: 'hoursSavedWeekly',
    label: 'Total hours saved / week',
    format: (v) => `${Number.isInteger(v) ? v : v.toFixed(1)}h`,
  },
  {
    key: 'timeSavedPct',
    label: 'Time saved',
    format: (v) => `${v}%`,
  },
  {
    key: 'roiMonthly',
    label: 'Monthly ROI',
    format: (v) => `$${v.toLocaleString()}`,
  },
];

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'KpiDisplay: no document provided and no global document'
  );
}

const REQUIRED_KPI_KEYS = [
  'timeSavedPct',
  'hoursSavedWeekly',
  'tasksAutomated',
  'totalTasks',
  'roiMonthly',
];

function validateKpis(kpis) {
  if (!kpis || typeof kpis !== 'object') {
    throw new Error('KpiDisplay: `kpis` must be an object');
  }
  for (const key of REQUIRED_KPI_KEYS) {
    if (typeof kpis[key] !== 'number') {
      throw new Error(
        `KpiDisplay: \`kpis.${key}\` must be a number, got ${typeof kpis[key]}`
      );
    }
  }
}

function createKpiDisplay({ kpis, calculationDetails = {}, document: docArg } = {}) {
  validateKpis(kpis);
  const doc = resolveDocument(docArg);

  const root = doc.createElement('div');
  root.className = 'kpi-display';
  root.setAttribute('data-testid', 'kpi-display');

  for (const spec of KPI_SPECS) {
    const item = doc.createElement('div');
    item.className = 'kpi-display__item';
    item.setAttribute('data-kpi-key', spec.key);

    const valueNode = doc.createElement('div');
    valueNode.className = 'kpi-display__value kpi-display__value--large';
    // Inline font-size locks in the "large font" requirement from Sub-AC 2c-i
    // even when no stylesheet is loaded (e.g. inside the render test).
    valueNode.style =
      'font-size: 2.5rem; font-weight: 700; line-height: 1.1;';

    const rawValue = kpis[spec.key];
    const formattedValue = spec.needsKpis
      ? spec.format(rawValue, kpis)
      : spec.format(rawValue);

    if (calculationDetails[spec.key]) {
      const details = doc.createElement('details');
      details.className = 'calculation-details calculation-details--kpi';
      const summary = doc.createElement('summary');
      summary.className = valueNode.className;
      summary.style = valueNode.style;
      summary.textContent = formattedValue;
      const body = doc.createElement('div');
      body.className = 'calculation-details__body';
      body.textContent = calculationDetails[spec.key];
      details.appendChild(summary);
      details.appendChild(body);
      item.appendChild(details);
    } else {
      valueNode.textContent = formattedValue;
      item.appendChild(valueNode);
    }

    const labelNode = doc.createElement('div');
    labelNode.className = 'kpi-display__label';
    labelNode.textContent = spec.label;

    item.appendChild(labelNode);
    root.appendChild(item);
  }

  return root;
}

module.exports = { createKpiDisplay, KPI_SPECS, REQUIRED_KPI_KEYS };
