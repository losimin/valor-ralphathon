const test = require('node:test');
const assert = require('node:assert/strict');

const { createKpiDisplay, KPI_SPECS } = require('../KpiDisplay');
const { computePersonaKpis } = require('../../lib/kpi');
const { personas } = require('../../data/personas');

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
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

function valueNode(item) {
  return item.children[0];
}

function labelNode(item) {
  return item.children[1];
}

test('KpiDisplay renders the four executive KPI items in requested order', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  const root = createKpiDisplay({ kpis, document: doc });

  assert.equal(root.children.length, 4);
  assert.deepEqual(
    root.children.map((item) => item.attributes['data-kpi-key']),
    ['tasksAutomated', 'hoursSavedWeekly', 'timeSavedPct', 'roiMonthly']
  );
  assert.deepEqual(
    root.children.map((item) => labelNode(item).textContent),
    [
      'No. of tasks automated',
      'Total hours saved / week',
      'Time saved',
      'Monthly ROI',
    ]
  );
});

test('KpiDisplay renders computed values for each persona', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const kpis = computePersonaKpis(persona);
    const root = createKpiDisplay({ kpis, document: doc });

    const expected = {
      tasksAutomated: `${kpis.tasksAutomated} of ${kpis.totalTasks}`,
      hoursSavedWeekly: `${
        Number.isInteger(kpis.hoursSavedWeekly)
          ? kpis.hoursSavedWeekly
          : kpis.hoursSavedWeekly.toFixed(1)
      }h`,
      timeSavedPct: `${kpis.timeSavedPct}%`,
      roiMonthly: `$${kpis.roiMonthly.toLocaleString()}`,
    };

    for (const item of root.children) {
      const key = item.attributes['data-kpi-key'];
      assert.equal(valueNode(item).textContent, expected[key]);
      assert.match(valueNode(item).className, /kpi-display__value--large/);
    }
  }
});

test('KpiDisplay validates required KPI keys', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  delete kpis.roiMonthly;

  assert.throws(() => createKpiDisplay({ kpis, document: doc }), /roiMonthly/);
});

test('KPI_SPECS has exactly four entries', () => {
  assert.equal(KPI_SPECS.length, 4);
});
