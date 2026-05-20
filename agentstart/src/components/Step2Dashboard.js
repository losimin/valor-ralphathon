// AgentStart — Step2Dashboard component
//
// A focused presentational component that composes the Step 2 dashboard
// surface from the canonical building blocks defined in earlier sub-ACs of
// this AC:
//
//   - `computePersonaKpis`  (lib/kpi.js)             — derives the top-line
//     numbers (time saved %, hours saved, tasks automated, weekly/monthly/
//     annual ROI) from a persona's hardcoded task list.
//   - `createKpiDisplay`    (components/KpiDisplay)  — renders those KPIs in
//     a large-font tile grid.
//   - `createTaskBreakdownTable` (components/TaskBreakdownTable) — renders
//     the per-task breakdown ordered by frequency, with explicit 95% CI
//     range columns.
//
// Step2Dashboard differs from `steps/Step2Analysis` in scope: this is a
// reusable dashboard block (no heading, no nav buttons, no form-state hook)
// suitable for embedding inside any step or summary surface. Step2Analysis
// already composes the same primitives at the step level; this component is
// the lower-level dashboard primitive that the sub-AC requires.
//
// Contract:
//   createStep2Dashboard({ persona, document })
//     - persona:  one entry from data/personas (must include tasks array and
//                 a numeric hourly_rate).
//     - document: DOM-like factory; defaults to global document.
//   Returns the root <section> element. The root exposes:
//     - root.kpis         : the KPI bundle from computePersonaKpis
//     - root.kpiDisplay   : the rendered KpiDisplay node
//     - root.breakdownTable : the rendered TaskBreakdownTable node
//     - root.taskRows     : the table's data <tr> rows in render order

const { computePersonaKpis } = require('../lib/kpi');
const { createKpiDisplay } = require('./KpiDisplay');
const { createTaskBreakdownTable } = require('./TaskBreakdownTable');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'Step2Dashboard: no document provided and no global document'
  );
}

function createStep2Dashboard({ persona, document: docArg } = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('Step2Dashboard: `persona` is required');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('Step2Dashboard: `persona.tasks` must be an array');
  }
  const doc = resolveDocument(docArg);

  const root = doc.createElement('section');
  root.className = 'step2-dashboard';
  root.setAttribute('data-testid', 'step2-dashboard');
  root.setAttribute('data-persona-id', String(persona.persona_id ?? ''));

  // 1. Top-line KPIs — large-font tiles
  const kpis = computePersonaKpis(persona);
  const rateDetail = persona.rate_detail || {};
  const kpiDisplay = createKpiDisplay({
    kpis,
    document: doc,
  });
  root.appendChild(kpiDisplay);

  // 2. Task breakdown — ordered by descending task_frequency with CI cells
  const breakdownTable = createTaskBreakdownTable({
    tasks: persona.tasks,
    hourlyRate: persona.hourly_rate,
    rateDetail,
    sortDimension: 'onet_frequency_score',
    document: doc,
  });
  const tableWrap = doc.createElement('div');
  tableWrap.className = 'task-breakdown-table-wrap';
  tableWrap.appendChild(breakdownTable);
  root.appendChild(tableWrap);

  root.kpis = kpis;
  root.kpiDisplay = kpiDisplay;
  root.breakdownTable = breakdownTable;
  root.taskRows = breakdownTable._dataRows;

  return root;
}

module.exports = { createStep2Dashboard };
