const test = require('node:test');
const assert = require('node:assert/strict');

const { createStep2Dashboard } = require('../Step2Dashboard');
const { personas } = require('../../data/personas');
const { computePersonaKpis } = require('../../lib/kpi');
const { sortTasksByDimension } = require('../../lib/taskSort');

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

test('Step2Dashboard renders four KPI tiles and a responsive table wrapper', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Dashboard({ persona, document: doc });

  const kpiDisplay = root.children.find((c) => c.className === 'kpi-display');
  const tableWrap = root.children.find(
    (c) => c.className === 'task-breakdown-table-wrap'
  );

  assert.ok(kpiDisplay);
  assert.equal(kpiDisplay.children.length, 4);
  assert.ok(tableWrap);
  assert.equal(tableWrap.children[0], root.breakdownTable);
});

test('Step2Dashboard task rows are ordered by descending frequency', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Dashboard({ persona, document: doc });

  const expectedOrder = sortTasksByDimension(persona.tasks, 'task_frequency')
    .slice(0, 5)
    .map((t) => t.task_name);
  const renderedOrder = root.taskRows.map(
    (row) => row.attributes['data-task-name']
  );

  assert.deepEqual(renderedOrder, expectedOrder);
});

test('Step2Dashboard exposes computed KPI data for every persona', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const root = createStep2Dashboard({ persona, document: doc });
    const expected = computePersonaKpis(persona);

    assert.equal(root.kpis.hoursSavedWeekly, expected.hoursSavedWeekly);
    assert.equal(root.kpis.roiMonthly, expected.roiMonthly);
    assert.ok(root.taskRows.length <= 5);
  }
});
