// AgentStart — TaskBreakdownTable component
//
// Renders a sortable task breakdown table with explicit confidence interval
// columns. This component delegates ordering to lib/taskSort.js (canonical
// sortTasksByDimension) so the table consistently matches Step 2's KPI
// dashboard and Step 3's workflow diagram ordering.
//
// The table surfaces every numeric ontology field for a task — frequency,
// current/projected hours, time-saved %, 95% CI bounds, automation confidence,
// and ROI values — in a structured <table> element with <thead> / <tbody>
// semantics so consuming code (Step2Analysis, Step4Configure, etc.) and
// tests can rely on standard DOM traversal.
//
// Contract:
//   createTaskBreakdownTable({ tasks, sortDimension, document })
//     - tasks:          array of task objects from data/personas
//     - sortDimension:  string — any valid sortTasksByDimension key
//                       (defaults to 'task_frequency')
//     - document:       DOM-like factory; defaults to global document
//   Returns the root <table> element. The root carries .references for
//   inspection in tests: root._tasks (sorted array), root._sortDimension.
//
// The confidence interval columns are rendered as "low – high" in a single
// cell and also available as individual data attributes for test assertions.

const { sortTasksByDimension } = require('../lib/taskSort');

// ── Column definitions ─────────────────────────────────────────────────────
// Each column spec describes: header label, accessor function, CSS modifier,
// and optional formatter. Columns are defined in display order.

const COLUMNS = Object.freeze([
  {
    key: 'task_name',
    label: 'Task',
    className: 'col--task-name',
    accessor: (t) => t.task_name,
  },
  {
    key: 'task_frequency',
    label: 'Frequency',
    className: 'col--frequency',
    accessor: (t) => t.task_frequency,
  },
  {
    key: 'current_hours_weekly',
    label: 'Current hrs/wk',
    className: 'col--current-hours',
    accessor: (t) => `${t.current_hours_weekly}`,
  },
  {
    key: 'projected_hours_weekly',
    label: 'Projected hrs/wk',
    className: 'col--projected-hours',
    accessor: (t) => `${t.projected_hours_weekly}`,
  },
  {
    key: 'time_saved_pct',
    label: 'Time saved',
    className: 'col--time-saved',
    accessor: (t) => `${t.time_saved_pct}%`,
  },
  {
    key: 'confidence_interval_low',
    label: 'CI low',
    className: 'col--ci-low',
    accessor: (t) => `${t.confidence_interval_low}%`,
  },
  {
    key: 'confidence_interval_high',
    label: 'CI high',
    className: 'col--ci-high',
    accessor: (t) => `${t.confidence_interval_high}%`,
  },
  {
    key: 'automation_confidence',
    label: 'Auto confidence',
    className: 'col--auto-confidence',
    accessor: (t) => `${t.automation_confidence}%`,
  },
  {
    key: 'roi_weekly',
    label: 'ROI / wk',
    className: 'col--roi-weekly',
    accessor: (t) => `$${t.roi_weekly.toLocaleString()}`,
  },
  {
    key: 'roi_monthly',
    label: 'ROI / mo',
    className: 'col--roi-monthly',
    accessor: (t) => `$${t.roi_monthly.toLocaleString()}`,
  },
  {
    key: 'agent_name',
    label: 'Agent',
    className: 'col--agent-name',
    accessor: (t) => t.agent_name,
  },
]);

// Keys that carry confidence interval information — used for test assertions
// that CI columns are present.
const CI_COLUMN_KEYS = ['confidence_interval_low', 'confidence_interval_high'];

const DEFAULT_SORT_DIMENSION = 'task_frequency';

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Main factory ────────────────────────────────────────────────────────────

function createTaskBreakdownTable({
  tasks,
  sortDimension = DEFAULT_SORT_DIMENSION,
  document: docArg,
} = {}) {
  validateArgs(tasks, sortDimension);
  const doc = resolveDocument(docArg);

  // Sort tasks using the canonical module — ensures consistency with
  // Step 2 dashboard ordering, Step 3 workflow diagram, etc.
  const sorted = sortTasksByDimension(tasks, sortDimension);

  // ── Build table ────────────────────────────────────────────────────────

  const table = doc.createElement('table');
  table.className = 'task-breakdown-table';
  table.setAttribute('data-testid', 'task-breakdown-table');
  table.setAttribute('data-sort-dimension', sortDimension);

  // <thead>
  const thead = doc.createElement('thead');
  thead.className = 'task-breakdown-table__head';

  const headerRow = doc.createElement('tr');
  headerRow.className = 'task-breakdown-table__header-row';

  for (const col of COLUMNS) {
    const th = doc.createElement('th');
    th.className = `task-breakdown-table__th ${col.className}`;
    th.setAttribute('data-col-key', col.key);
    th.textContent = col.label;
    // CI columns carry an extra attribute so tests can locate them
    // without depending on display labels.
    if (CI_COLUMN_KEYS.includes(col.key)) {
      th.setAttribute('data-ci-column', 'true');
    }
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // <tbody>
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

      const value = col.accessor(task);
      td.textContent = value;

      // For CI columns, expose the raw numeric value as a data attribute
      // so tests can programmatically verify the interval values without
      // parsing text content.
      if (CI_COLUMN_KEYS.includes(col.key)) {
        td.setAttribute('data-ci-value', String(task[col.key]));
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
    return tr;
  });

  table.appendChild(tbody);

  // ── Attach inspection references ───────────────────────────────────────
  table._tasks = sorted;
  table._sortDimension = sortDimension;
  table._dataRows = dataRows;
  table._columns = COLUMNS;

  return table;
}

module.exports = {
  createTaskBreakdownTable,
  COLUMNS,
  CI_COLUMN_KEYS,
  DEFAULT_SORT_DIMENSION,
};
