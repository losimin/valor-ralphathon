// AgentStart — Step 2: Workflow Analysis
//
// Renders the pre-populated workflow analysis for a single persona. This is
// the view that mounts when the user picks a card in Step 1. The seed's
// ontology is exposed here via the KpiDisplay component (top-line KPIs) and
// a per-task breakdown so downstream steps (workflow diagram, agent config)
// can reuse the same data module without recomputation.
//
// KPI computation is delegated to lib/kpi.js and rendering to the
// KpiDisplay component so the formulas and presentation are centralised.
//
// Contract:
//   createStep2Analysis({ persona, document, onBack?, onNext? })
//     - persona:  one entry from data/personas (must include tasks array)
//     - document: DOM-like factory; defaults to global document
//     - onBack:   optional callback wired to a "Back" button
//     - onNext:   optional callback wired to a "Next" button
//   Returns the root element. The root carries `persona` and `taskRows`
//   references for ease of inspection in tests.

const { computePersonaKpis } = require('../lib/kpi');
const { createKpiDisplay } = require('../components/KpiDisplay');
const { createTaskBreakdownTable } = require('../components/TaskBreakdownTable');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'Step2Analysis: no document provided and no global document'
  );
}

function createStep2Analysis({ persona, document: docArg, onBack, onNext } = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('Step2Analysis: `persona` is required');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('Step2Analysis: `persona.tasks` must be an array');
  }
  const doc = resolveDocument(docArg);

  const root = doc.createElement('section');
  root.className = 'step step--analysis';
  root.setAttribute('data-step', '2');
  root.setAttribute('data-persona-id', String(persona.persona_id ?? ''));

  // Heading clearly identifies the selected persona — the click-through test
  // asserts this text contains the matched persona's display name.
  const heading = doc.createElement('h1');
  heading.className = 'step__heading';
  heading.textContent = `Workflow analysis for ${persona.persona_name}`;
  root.appendChild(heading);

  const rate = doc.createElement('p');
  rate.className = 'analysis__rate';
  rate.textContent = `Hourly rate: $${persona.hourly_rate}/hr · ${persona.rate_source}`;
  root.appendChild(rate);

  // Top-line KPIs delegated to the KpiDisplay component so the large-font
  // rendering and value formatting stay in one place.
  const kpiData = computePersonaKpis(persona);
  const kpiDisplay = createKpiDisplay({ kpis: kpiData, document: doc });
  root.appendChild(kpiDisplay);
  root.kpiDisplay = kpiDisplay;

  // Task breakdown table — ordered by frequency (highest first) so the
  // most-impactful items surface at the top. Uses the canonical
  // TaskBreakdownTable component which delegates to sortTasksByDimension
  // and renders explicit confidence interval columns.
  const breakdownTable = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'task_frequency',
    document: doc,
  });
  root.appendChild(breakdownTable);
  root.breakdownTable = breakdownTable;

  // Backward-compatible taskRows reference — maps to the table's data
  // rows so existing tests that inspect root.taskRows still resolve.
  const taskRows = breakdownTable._dataRows;

  if (typeof onBack === 'function') {
    const back = doc.createElement('button');
    back.className = 'step__back';
    back.setAttribute('type', 'button');
    back.textContent = '← Back to roles';
    back.addEventListener('click', () => onBack());
    root.appendChild(back);
    root.backButton = back;
  }

  if (typeof onNext === 'function') {
    const next = doc.createElement('button');
    next.className = 'step__next step__next--primary';
    next.setAttribute('type', 'button');
    next.textContent = 'View agent workflow →';
    next.addEventListener('click', () => onNext());
    root.appendChild(next);
    root.nextButton = next;
  }

  root.persona = persona;
  root.taskRows = taskRows;

  // ── Form state for save-on-exit persistence ────────────────────────────
  //
  // Step 2 is a read-only KPI dashboard whose content is fully derived from
  // the selected persona. The form state records the view context so the
  // store can reconstruct the analysis view without re-deriving metrics.
  root.getFormState = () => ({
    personaId: persona.persona_id,
    totalCurrentHours: kpiData.totalCurrentHours,
    totalProjectedHours: kpiData.totalProjectedHours,
    hoursSaved: kpiData.hoursSavedWeekly,
    pctSaved: kpiData.timeSavedPct,
    tasksAutomated: kpiData.tasksAutomated,
    totalTasks: kpiData.totalTasks,
    roiWeekly: kpiData.roiWeekly,
    roiMonthly: kpiData.roiMonthly,
    roiAnnual: kpiData.roiAnnual,
    taskCount: persona.tasks.length,
  });

  return root;
}

module.exports = { createStep2Analysis };
