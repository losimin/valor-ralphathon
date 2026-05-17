// Render tests for Step2Dashboard — the reusable Step 2 dashboard block.
//
// Per sub-AC 5 we assert:
//   1. The KPI display renders all six KPI tiles in large font with the
//      values produced by computePersonaKpis (delegating to lib/kpi.js).
//   2. The task breakdown list renders rows ordered by descending
//      task_frequency, each row exposing the 95% CI range columns.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStep2Dashboard } = require('../Step2Dashboard');
const { personas } = require('../../data/personas');
const { computePersonaKpis } = require('../../lib/kpi');
const { sortTasksByDimension } = require('../../lib/taskSort');

// Minimal DOM stub — matches the shape used by sibling component tests.
function createFakeDocument() {
  function makeNode(tagName) {
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
      addEventListener() {},
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

function expectedKpiValueByKey(persona) {
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

test('Step2Dashboard renders KPI display with six large-font tiles', () => {
  const persona = personas[0]; // Editor
  const doc = createFakeDocument();
  const root = createStep2Dashboard({ persona, document: doc });

  // KpiDisplay is the first child (KPI tiles row).
  const kpiDisplay = root.children.find((c) => c.className === 'kpi-display');
  assert.ok(kpiDisplay, 'expected a kpi-display container');
  assert.equal(kpiDisplay.children.length, 6, 'expected exactly 6 KPI tiles');

  const expected = expectedKpiValueByKey(persona);
  for (const item of kpiDisplay.children) {
    const key = item.attributes['data-kpi-key'];
    const valueNode = item.children[0];

    assert.equal(
      valueNode.textContent,
      expected[key],
      `KPI "${key}" should render "${expected[key]}", got "${valueNode.textContent}"`
    );

    // Large-font requirement: --large modifier class + inline font-size ≥ 2rem.
    assert.match(
      valueNode.className,
      /kpi-display__value--large/,
      `KPI "${key}" value should carry the --large modifier class`
    );
    const m = /font-size:\s*([\d.]+)rem/.exec(valueNode.style);
    assert.ok(m, `KPI "${key}" should have an inline rem font-size`);
    assert.ok(
      parseFloat(m[1]) >= 2,
      `KPI "${key}" font-size should be >= 2rem`
    );
  }
});

test('Step2Dashboard renders task rows ordered by descending frequency with CI ranges', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Dashboard({ persona, document: doc });

  const expectedOrder = sortTasksByDimension(persona.tasks, 'task_frequency')
    .map((t) => t.task_name);

  const renderedOrder = root.taskRows.map(
    (row) => row.attributes['data-task-name']
  );
  assert.deepEqual(
    renderedOrder,
    expectedOrder,
    'task rows should be ordered by descending task_frequency'
  );

  for (let i = 0; i < root.taskRows.length; i++) {
    const row = root.taskRows[i];
    const task = persona.tasks.find(
      (t) => t.task_name === row.attributes['data-task-name']
    );

    const ciLow = row.children.find(
      (c) => c.attributes['data-col-key'] === 'confidence_interval_low'
    );
    const ciHigh = row.children.find(
      (c) => c.attributes['data-col-key'] === 'confidence_interval_high'
    );

    assert.ok(ciLow, `row ${i} should have a CI low cell`);
    assert.ok(ciHigh, `row ${i} should have a CI high cell`);

    assert.equal(
      ciLow.attributes['data-ci-value'],
      String(task.confidence_interval_low),
      `row ${i} CI low data attribute mismatch`
    );
    assert.equal(
      ciHigh.attributes['data-ci-value'],
      String(task.confidence_interval_high),
      `row ${i} CI high data attribute mismatch`
    );
    assert.ok(
      ciLow.textContent.includes(`${task.confidence_interval_low}%`),
      `row ${i} CI low should display "${task.confidence_interval_low}%"`
    );
    assert.ok(
      ciHigh.textContent.includes(`${task.confidence_interval_high}%`),
      `row ${i} CI high should display "${task.confidence_interval_high}%"`
    );
  }
});

test('Step2Dashboard renders successfully for every persona', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const root = createStep2Dashboard({ persona, document: doc });

    const kpiDisplay = root.children.find(
      (c) => c.className === 'kpi-display'
    );
    assert.equal(
      kpiDisplay.children.length,
      6,
      `persona ${persona.persona_id} should render 6 KPI tiles`
    );
    assert.equal(
      root.taskRows.length,
      persona.tasks.length,
      `persona ${persona.persona_id} should render one row per task`
    );

    // Sanity: the root exposes the computed KPI bundle.
    const expected = computePersonaKpis(persona);
    assert.equal(root.kpis.timeSavedPct, expected.timeSavedPct);
    assert.equal(root.kpis.roiWeekly, expected.roiWeekly);
  }
});
