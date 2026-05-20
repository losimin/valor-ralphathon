// AgentStart - Step 2: Workflow Analysis

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

  const heading = doc.createElement('h1');
  heading.className = 'step__heading';
  heading.textContent = `Workflow analysis for ${persona.persona_name}`;
  root.appendChild(heading);

  const kpiData = computePersonaKpis(persona);
  const rateDetail = persona.rate_detail || {};
  const kpiDisplay = createKpiDisplay({
    kpis: kpiData,
    document: doc,
  });
  root.appendChild(kpiDisplay);
  root.kpiDisplay = kpiDisplay;

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
  root.breakdownTable = breakdownTable;

  const taskRows = breakdownTable._dataRows;

  if (typeof onBack === 'function') {
    const back = doc.createElement('button');
    back.className = 'step__back';
    back.setAttribute('type', 'button');
    back.textContent = '<- Back to roles';
    back.addEventListener('click', () => onBack());
    root.appendChild(back);
    root.backButton = back;
  }

  if (typeof onNext === 'function') {
    const next = doc.createElement('button');
    next.className = 'step__next step__next--primary';
    next.setAttribute('type', 'button');
    next.textContent = 'View agent workflow ->';
    next.addEventListener('click', () => onNext());
    root.appendChild(next);
    root.nextButton = next;
  }

  root.persona = persona;
  root.taskRows = taskRows;

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
