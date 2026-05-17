// Render tests for KpiDisplay — the top-line KPI dashboard component.
//
// Per Sub-AC 2c-i we assert:
//   1. The component renders all KPI values with the expected numbers
//      derived from the computePersonaKpis output.
//   2. Each KPI value is rendered in "large font" — verified by checking
//      the --large modifier class AND the inline font-size property.
//   3. Input validation rejects missing or malformed kpis objects.
//   4. Every persona's KPI bundle renders correctly end-to-end.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createKpiDisplay, KPI_SPECS } = require('../KpiDisplay');
const { computePersonaKpis } = require('../../lib/kpi');
const { personas } = require('../../data/personas');

// Minimal DOM stub following the established project pattern.
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

// ── Helpers ───────────────────────────────────────────────────────────────

function getValueNode(item) {
  return item.children[0];
}

function getLabelNode(item) {
  return item.children[1];
}

// ── Rendering ─────────────────────────────────────────────────────────────

test('KpiDisplay renders exactly 6 KPI items (matching KPI_SPECS count)', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]); // Editor
  const root = createKpiDisplay({ kpis, document: doc });

  assert.equal(root.className, 'kpi-display');
  assert.equal(root.attributes['data-testid'], 'kpi-display');
  assert.equal(root.children.length, 6, 'expected 6 KPI items');
});

test('KpiDisplay renders correct KPI values for all five personas', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const kpis = computePersonaKpis(persona);
    const root = createKpiDisplay({ kpis, document: doc });

    const expectedValues = {
      timeSavedPct: `${kpis.timeSavedPct}%`,
      hoursSavedWeekly: `${kpis.hoursSavedWeekly}h`,
      tasksAutomated: `${kpis.tasksAutomated} of ${kpis.totalTasks}`,
      roiWeekly: `$${kpis.roiWeekly.toLocaleString()}`,
      roiMonthly: `$${kpis.roiMonthly.toLocaleString()}`,
      roiAnnual: `$${kpis.roiAnnual.toLocaleString()}`,
    };

    for (const item of root.children) {
      const key = item.attributes['data-kpi-key'];
      const actualValue = getValueNode(item).textContent;
      assert.equal(
        actualValue,
        expectedValues[key],
        `${persona.persona_id}: expected KPI "${key}" = "${expectedValues[key]}", got "${actualValue}"`
      );
    }
  }
});

test('KpiDisplay renders correct labels for each KPI', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  const root = createKpiDisplay({ kpis, document: doc });

  const expectedLabels = [
    'Time saved',
    'Hours saved / week',
    'Tasks automated',
    'Weekly ROI',
    'Monthly ROI',
    'Annual ROI',
  ];

  const actualLabels = root.children.map((item) => getLabelNode(item).textContent);
  assert.deepEqual(actualLabels, expectedLabels);
});

// ── Large-font verification ───────────────────────────────────────────────

test('KpiDisplay renders each value with the --large modifier class', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  const root = createKpiDisplay({ kpis, document: doc });

  for (const item of root.children) {
    const valueNode = getValueNode(item);
    assert.match(
      valueNode.className,
      /kpi-display__value--large/,
      `KPI "${item.attributes['data-kpi-key']}" value should carry the --large modifier class`
    );
  }
});

test('KpiDisplay applies inline font-size ≥ 2rem on every KPI value', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  const root = createKpiDisplay({ kpis, document: doc });

  for (const item of root.children) {
    const valueNode = getValueNode(item);
    const m = /font-size:\s*([\d.]+)rem/.exec(valueNode.style);
    assert.ok(
      m,
      `KPI "${item.attributes['data-kpi-key']}" value should have inline font-size, got: "${valueNode.style}"`
    );
    const sizeRem = parseFloat(m[1]);
    assert.ok(
      sizeRem >= 2,
      `KPI "${item.attributes['data-kpi-key']}" font-size should be ≥ 2rem to qualify as large, got ${sizeRem}rem`
    );
  }
});

test('KpiDisplay inline style includes font-weight: 700 and line-height: 1.1', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  const root = createKpiDisplay({ kpis, document: doc });

  const valueNode = getValueNode(root.children[0]);
  assert.match(valueNode.style, /font-weight:\s*700/);
  assert.match(valueNode.style, /line-height:\s*1\.1/);
});

// ── Each KPI item carries data-kpi-key attribute ──────────────────────────

test('KpiDisplay sets data-kpi-key attribute matching KPI_SPECS', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  const root = createKpiDisplay({ kpis, document: doc });

  const specKeys = KPI_SPECS.map((s) => s.key);
  const renderedKeys = root.children.map((item) => item.attributes['data-kpi-key']);
  assert.deepEqual(renderedKeys, specKeys);
});

// ── Input validation ──────────────────────────────────────────────────────

test('KpiDisplay throws when kpis is missing', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createKpiDisplay({ document: doc }),
    /kpis/
  );
});

test('KpiDisplay throws when kpis is not an object', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createKpiDisplay({ kpis: null, document: doc }),
    /kpis/
  );
  assert.throws(
    () => createKpiDisplay({ kpis: 'not-an-object', document: doc }),
    /kpis/
  );
});

test('KpiDisplay throws when a required key is missing', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]);
  delete kpis.timeSavedPct;

  assert.throws(
    () => createKpiDisplay({ kpis, document: doc }),
    /kpis\.timeSavedPct/
  );
});

test('KpiDisplay throws when a required key is not a number', () => {
  const doc = createFakeDocument();
  const kpis = { ...computePersonaKpis(personas[0]), roiWeekly: 'lots' };

  assert.throws(
    () => createKpiDisplay({ kpis, document: doc }),
    /kpis\.roiWeekly/
  );
});

// ── Cross-persona consistency ─────────────────────────────────────────────

test('KpiDisplay renders without error for all five personas', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const kpis = computePersonaKpis(persona);
    const root = createKpiDisplay({ kpis, document: doc });

    assert.equal(root.children.length, 6, persona.persona_id);
    assert.equal(root.className, 'kpi-display', persona.persona_id);

    // Verify the "tasks automated" value is between 0 and totalTasks
    const tasksItem = root.children.find(
      (i) => i.attributes['data-kpi-key'] === 'tasksAutomated'
    );
    const tasksText = getValueNode(tasksItem).textContent;
    assert.match(tasksText, /^\d+ of \d+$/);
    const [automated, total] = tasksText.split(' of ').map(Number);
    assert.ok(automated >= 0);
    assert.ok(automated <= total);
    assert.equal(total, persona.tasks.length);
  }
});

// ── Specific value checks for Editor ──────────────────────────────────────

test('KpiDisplay renders Editor KPIs with exact computed values', () => {
  const doc = createFakeDocument();
  const kpis = computePersonaKpis(personas[0]); // Editor
  const root = createKpiDisplay({ kpis, document: doc });

  // Time saved: 63%
  assert.equal(
    getValueNode(root.children[0]).textContent,
    '63%'
  );
  // Hours saved/week: 19h
  assert.equal(
    getValueNode(root.children[1]).textContent,
    '19h'
  );
  // Tasks automated: 2 of 4
  assert.equal(
    getValueNode(root.children[2]).textContent,
    '2 of 4'
  );
  // Weekly ROI: $684
  assert.equal(
    getValueNode(root.children[3]).textContent,
    '$684'
  );
  // Monthly ROI: $2,962
  assert.equal(
    getValueNode(root.children[4]).textContent,
    '$2,962'
  );
  // Annual ROI: $35,568
  assert.equal(
    getValueNode(root.children[5]).textContent,
    '$35,568'
  );
});

// ── Specific value checks for Customer Service Rep (different counts) ─────

test('KpiDisplay renders Customer Service Rep KPIs with correct tasks automated', () => {
  const doc = createFakeDocument();
  const csr = personas.find((p) => p.persona_id === 'customer_service_rep');
  const kpis = computePersonaKpis(csr);
  const root = createKpiDisplay({ kpis, document: doc });

  // Tasks automated: 4 of 5
  assert.equal(
    getValueNode(root.children[2]).textContent,
    '4 of 5'
  );
  // Weekly ROI: $570
  assert.equal(
    getValueNode(root.children[3]).textContent,
    '$570'
  );
});

// ── KPI_SPECS export integrity ────────────────────────────────────────────

test('KPI_SPECS has exactly 6 entries with required keys', () => {
  assert.equal(KPI_SPECS.length, 6);
  for (const spec of KPI_SPECS) {
    assert.ok(typeof spec.key === 'string', `spec missing key`);
    assert.ok(typeof spec.label === 'string', `spec ${spec.key} missing label`);
    assert.ok(typeof spec.format === 'function', `spec ${spec.key} missing format function`);
  }
});
