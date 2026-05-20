// AgentStart - TaskBreakdownTable component
//
// Renders the Step 2 executive task table:
// tasks, exposure to LLM, projected weekly hours saved, monthly ROI, and agent.
// Rows are ordered by descending O*NET-derived task frequency and capped at
// five rows. Source citations are rendered in the table footer.

const { sortTasksByDimension } = require('../lib/taskSort');
const {
  DASHBOARD_WORK_WEEK_HOURS,
  DAYS_PER_MONTH,
  DAYS_PER_WEEK,
  taskExposureToLlm,
  taskProjectedHoursSavedWeekly,
  taskRoiMonthlyFromProjectedHours,
} = require('../lib/kpi');

const COLUMNS = Object.freeze([
  {
    key: 'task_name',
    label: 'Tasks',
    className: 'col--task-name',
    accessor: (t) => t.task_name,
  },
  {
    key: 'exposure_to_llm',
    label: 'Exposure to LLM',
    className: 'col--exposure',
    accessor: (t) => taskExposureToLlm(t),
  },
  {
    key: 'projected_hours_saved_weekly',
    label: 'Hours saved / week',
    className: 'col--projected-saved',
    accessor: (t, ctx) => {
      const value = taskProjectedHoursSavedWeekly(t, ctx.tasks);
      return `${Number(value.toFixed(1))}h`;
    },
    detail: (t, ctx) => {
      const totalFrequency = ctx.tasks.reduce(
        (sum, task) => sum + Math.max(0, task.task_frequency || 0),
        0
      );
      const frequencyShare = totalFrequency
        ? ((t.task_frequency / totalFrequency) * 100).toFixed(1)
        : '0.0';
      const humanOnly = t.human_only_time ?? t.current_hours_weekly;
      const humanWithAi = t.human_with_ai_time ?? t.projected_hours_weekly;
      const timeReduction = humanOnly
        ? (((humanOnly - humanWithAi) / humanOnly) * 100).toFixed(1)
        : '0.0';
      return [
        `Frequency share: ${t.task_frequency}/${totalFrequency} (${frequencyShare}%).`,
        `Weekly baseline: ${DASHBOARD_WORK_WEEK_HOURS} hours.`,
        `Human-only time: ${humanOnly}h; human-with-AI time: ${humanWithAi}h.`,
        `Formula: frequency share * ${DASHBOARD_WORK_WEEK_HOURS} / human-only time * time reduction (${timeReduction}%).`,
      ].join('\n');
    },
  },
  {
    key: 'roi_monthly_projected',
    label: 'ROI / month',
    className: 'col--roi-monthly',
    accessor: (t, ctx) =>
      `$${taskRoiMonthlyFromProjectedHours(
        t,
        ctx.hourlyRate,
        ctx.tasks
      ).toLocaleString()}`,
    detail: (t, ctx) => {
      const projected = taskProjectedHoursSavedWeekly(t, ctx.tasks);
      const rate = ctx.rateDetail || {};
      const annualWage = rate.mean_annual_wage
        ? `$${rate.mean_annual_wage.toLocaleString()}`
        : 'the BLS mean annual wage';
      const hourlyRateDetail = rate.mean_annual_wage
        ? `${annualWage} / 2,080 work-year hours = ~$${ctx.hourlyRate}/hr`
        : `BLS-derived hourly rate = $${ctx.hourlyRate}/hr`;
      return [
        `Hourly rate input: ${hourlyRateDetail}.`,
        `Hours saved/week: ${Number(projected.toFixed(1))}h.`,
        `Formula: $${ctx.hourlyRate}/hr * (${Number(projected.toFixed(3))} / ${DAYS_PER_WEEK}) * ${DAYS_PER_MONTH}.`,
      ].join('\n');
    },
  },
  {
    key: 'agent_name',
    label: 'Agent',
    className: 'col--agent-name',
    accessor: (t) => t.agent_name,
  },
]);

const DEFAULT_SORT_DIMENSION = 'task_frequency';
const DEFAULT_MAX_ROWS = 5;
const CI_COLUMN_KEYS = Object.freeze([]);

const SOURCE_NOTE =
  'Sources: O*NET Database task frequency ratings (https://www.onetcenter.org/database.html); Anthropic Economic Index, "Which Economic Tasks are Performed with AI?", for automation/augmentation exposure and human-only vs. human-with-AI timing (https://huggingface.co/datasets/Anthropic/EconomicIndex); BLS OEWS wage data for hourly rates (https://www.bls.gov/oes/tables.htm).';

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'TaskBreakdownTable: no document provided and no global document'
  );
}

function validateArgs(tasks, sortDimension) {
  if (!Array.isArray(tasks)) {
    throw new Error('TaskBreakdownTable: `tasks` must be an array');
  }
  if (typeof sortDimension !== 'string' || !sortDimension) {
    throw new Error(
      'TaskBreakdownTable: `sortDimension` must be a non-empty string'
    );
  }
}

function createTaskBreakdownTable({
  tasks,
  hourlyRate = 0,
  rateDetail = null,
  maxRows = DEFAULT_MAX_ROWS,
  sortDimension = DEFAULT_SORT_DIMENSION,
  document: docArg,
} = {}) {
  validateArgs(tasks, sortDimension);
  const doc = resolveDocument(docArg);

  const sorted = sortTasksByDimension(tasks, sortDimension).slice(0, maxRows);
  const context = { tasks, hourlyRate, rateDetail };

  const table = doc.createElement('table');
  table.className = 'task-breakdown-table';
  table.setAttribute('data-testid', 'task-breakdown-table');
  table.setAttribute('data-sort-dimension', sortDimension);

  const thead = doc.createElement('thead');
  thead.className = 'task-breakdown-table__head';

  const headerRow = doc.createElement('tr');
  headerRow.className = 'task-breakdown-table__header-row';

  for (const col of COLUMNS) {
    const th = doc.createElement('th');
    th.className = `task-breakdown-table__th ${col.className}`;
    th.setAttribute('data-col-key', col.key);
    th.textContent = col.label;
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  tbody.className = 'task-breakdown-table__body';

  const dataRows = sorted.map((task, idx) => {
    const tr = doc.createElement('tr');
    tr.className = 'task-breakdown-table__row';
    tr.setAttribute('data-task-index', String(idx));
    tr.setAttribute('data-task-name', task.task_name);

    for (const col of COLUMNS) {
      const td = doc.createElement('td');
      td.className = `task-breakdown-table__td ${col.className}`;
      td.setAttribute('data-col-key', col.key);
      if (typeof col.detail === 'function') {
        const details = doc.createElement('details');
        details.className = 'calculation-details';
        const summary = doc.createElement('summary');
        summary.className = 'calculation-details__summary';
        summary.textContent = col.accessor(task, context);
        const body = doc.createElement('div');
        body.className = 'calculation-details__body';
        body.textContent = col.detail(task, context);
        details.appendChild(summary);
        details.appendChild(body);
        td.appendChild(details);
      } else {
        td.textContent = col.accessor(task, context);
      }
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
    return tr;
  });

  table.appendChild(tbody);

  const tfoot = doc.createElement('tfoot');
  tfoot.className = 'task-breakdown-table__foot';

  const totalHoursSaved = sorted.reduce(
    (sum, task) => sum + taskProjectedHoursSavedWeekly(task, tasks),
    0
  );
  const totalMonthlyRoi = sorted.reduce(
    (sum, task) =>
      sum + taskRoiMonthlyFromProjectedHours(task, hourlyRate, tasks),
    0
  );
  const totalRow = doc.createElement('tr');
  totalRow.className = 'task-breakdown-table__total-row';
  for (const col of COLUMNS) {
    const td = doc.createElement('td');
    td.className = `task-breakdown-table__td task-breakdown-table__total ${col.className}`;
    td.setAttribute('data-col-key', col.key);
    if (col.key === 'task_name') {
      td.textContent = 'Total';
    } else if (col.key === 'projected_hours_saved_weekly') {
      td.textContent = `${Number(totalHoursSaved.toFixed(1))}h`;
    } else if (col.key === 'roi_monthly_projected') {
      td.textContent = `$${totalMonthlyRoi.toLocaleString()}`;
    } else {
      td.textContent = '';
    }
    totalRow.appendChild(td);
  }
  tfoot.appendChild(totalRow);

  const sourceRow = doc.createElement('tr');
  sourceRow.className = 'task-breakdown-table__source-row';
  const sourceCell = doc.createElement('td');
  sourceCell.className = 'task-breakdown-table__sources';
  sourceCell.setAttribute('colspan', String(COLUMNS.length));
  sourceCell.textContent = SOURCE_NOTE;
  sourceRow.appendChild(sourceCell);
  tfoot.appendChild(sourceRow);
  table.appendChild(tfoot);

  table._tasks = sorted;
  table._sortDimension = sortDimension;
  table._dataRows = dataRows;
  table._columns = COLUMNS;
  table._sourceNote = SOURCE_NOTE;

  return table;
}

module.exports = {
  createTaskBreakdownTable,
  COLUMNS,
  CI_COLUMN_KEYS,
  DEFAULT_SORT_DIMENSION,
  DEFAULT_MAX_ROWS,
  SOURCE_NOTE,
};
