// Render tests for Step2Analysis — the KPI dashboard.
//
// Per sub-AC 4 we assert three things:
//   1. The six top-line KPI values are rendered with the expected numbers
//      derived from the persona's hardcoded task data, including the new
//      "tasks automated" KPI.
//   2. Each KPI value is rendered in "large font" (large-font class + an
//      inline font-size override so the styling survives without CSS).
//   3. The task breakdown list is ordered by descending task_frequency and
//      each row exposes the 95% confidence interval range.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStep2Analysis } = require('../Step2Analysis');
const { personas } = require('../../data/personas');
const { computePersonaKpis } = require('../../lib/kpi');
const { sortTasksByDimension } = require('../../lib/taskSort');

// Minimal DOM stub matching the one used by sibling step tests. Nodes accept
// arbitrary property assignment (`style`, `persona`, `taskRows`, ...) which
// is exactly what the component does on real DOM elements.
function createFakeDocument() {
  function makeNode(tagName) {
    const listeners = {};
    return {
      tagName,
      children: [],
      attributes: {},
      className: '',
      textContent: '',
      style: '',
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
      addEventListener(event, handler) {
        (listeners[event] = listeners[event] || []).push(handler);
      },
      dispatch(event) {
        (listeners[event] || []).forEach((h) => h());
      },
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

function expectedKpis(persona) {
  const kpis = computePersonaKpis(persona);
  return {
    timeSavedPct: `${kpis.timeSavedPct}%`,
    hoursSavedWeekly: `${kpis.hoursSavedWeekly}h`,
    tasksAutomated: `${kpis.tasksAutomated} of ${kpis.totalTasks}`,
    roiWeekly: `$${kpis.roiWeekly.toLocaleString()}`,
    roiMonthly: `$${kpis.roiMonthly.toLocaleString()}`,
    roiAnnual: `$${kpis.roiAnnual.toLocaleString()}`,
  };
}

test('Step2Analysis renders the six top-line KPI values for the persona', () => {
  const persona = personas[0]; // Editor
  const doc = createFakeDocument();
  const root = createStep2Analysis({ persona, document: doc });

  // Locate the KPI display container by class.
  const kpiDisplay = root.children.find(
    (c) => c.className === 'kpi-display'
  );
  assert.ok(kpiDisplay, 'expected a kpi-display container');
  assert.equal(kpiDisplay.children.length, 6, 'expected exactly 6 KPI items');

  const expected = expectedKpis(persona);
  for (const item of kpiDisplay.children) {
    const key = item.attributes['data-kpi-key'];
    const actualValue = item.children[0].textContent;
    assert.equal(
      actualValue,
      expected[key],
      `KPI "${key}" should render "${expected[key]}", got "${actualValue}"`
    );
  }
});

test('Step2Analysis renders KPI values in large font', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Analysis({ persona, document: doc });
  const kpiDisplay = root.children.find((c) => c.className === 'kpi-display');

  for (const item of kpiDisplay.children) {
    const valueNode = item.children[0];
    assert.match(
      valueNode.className,
      /kpi-display__value--large/,
      'KPI value node should carry the --large modifier class'
    );
    // Inline style guarantees the large-font requirement holds even without
    // a stylesheet loaded — assert the font-size is at least 2rem.
    const m = /font-size:\s*([\d.]+)rem/.exec(valueNode.style);
    assert.ok(m, `expected inline font-size on KPI value, got: ${valueNode.style}`);
    const sizeRem = parseFloat(m[1]);
    assert.ok(
      sizeRem >= 2,
      `KPI font-size should be >= 2rem to qualify as large, got ${sizeRem}rem`
    );
  }
});

test('Step2Analysis renders task rows ordered by descending frequency with CI display', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Analysis({ persona, document: doc });

  const expectedOrder = sortTasksByDimension(persona.tasks, 'task_frequency')
    .map((t) => t.task_name);

  // The component exposes taskRows (now table <tr> elements) in render order.
  const renderedOrder = root.taskRows.map(
    (row) => row.attributes['data-task-name']
  );
  assert.deepEqual(
    renderedOrder,
    expectedOrder,
    'task rows should be ordered by descending task_frequency'
  );

  // Each row is a <tr> with <td> children. Find the CI and time-saved cells
  // by their data-col-key attributes — the table component exposes these.
  for (let i = 0; i < root.taskRows.length; i++) {
    const row = root.taskRows[i];
    const task = persona.tasks.find(
      (t) => t.task_name === row.attributes['data-task-name']
    );

    // CI low cell
    const ciLowCell = row.children.find(
      (c) => c.attributes['data-col-key'] === 'confidence_interval_low'
    );
    assert.ok(ciLowCell, `row ${i} missing CI low cell`);
    assert.equal(
      ciLowCell.attributes['data-ci-value'],
      String(task.confidence_interval_low),
      `row ${i} CI low value mismatch`
    );
    assert.ok(
      ciLowCell.textContent.includes(`${task.confidence_interval_low}%`),
      `row ${i} CI low cell should show "${task.confidence_interval_low}%"`
    );

    // CI high cell
    const ciHighCell = row.children.find(
      (c) => c.attributes['data-col-key'] === 'confidence_interval_high'
    );
    assert.ok(ciHighCell, `row ${i} missing CI high cell`);
    assert.equal(
      ciHighCell.attributes['data-ci-value'],
      String(task.confidence_interval_high),
      `row ${i} CI high value mismatch`
    );
    assert.ok(
      ciHighCell.textContent.includes(`${task.confidence_interval_high}%`),
      `row ${i} CI high cell should show "${task.confidence_interval_high}%"`
    );

    // Time saved cell
    const timeSavedCell = row.children.find(
      (c) => c.attributes['data-col-key'] === 'time_saved_pct'
    );
    assert.ok(timeSavedCell, `row ${i} missing time saved cell`);
    assert.equal(
      timeSavedCell.textContent,
      `${task.time_saved_pct}%`,
      `row ${i} time saved should be "${task.time_saved_pct}%"`
    );

    // ROI weekly cell
    const roiCell = row.children.find(
      (c) => c.attributes['data-col-key'] === 'roi_weekly'
    );
    assert.ok(roiCell, `row ${i} missing ROI weekly cell`);
    assert.ok(
      roiCell.textContent.startsWith('$'),
      `row ${i} ROI should start with $`
    );
  }
});

test('Step2Analysis renders for every persona without throwing and respects required KPI count', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const root = createStep2Analysis({ persona, document: doc });
    const kpiDisplay = root.children.find((c) => c.className === 'kpi-display');
    assert.equal(
      kpiDisplay.children.length,
      6,
      `persona ${persona.persona_id} should render 6 KPI items`
    );
    assert.equal(
      root.taskRows.length,
      persona.tasks.length,
      `persona ${persona.persona_id} should render one row per task`
    );
  }
});
