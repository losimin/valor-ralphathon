const test = require('node:test');
const assert = require('node:assert/strict');

const { createStep2Analysis } = require('../Step2Analysis');
const { personas } = require('../../data/personas');
const { computePersonaKpis } = require('../../lib/kpi');

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
        (listeners[event] || []).forEach((handler) => handler());
      },
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

test('Step2Analysis renders the selected persona heading without a rate strip', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Analysis({ persona, document: doc });

  assert.equal(root.attributes['data-step'], '2');
  assert.equal(root.attributes['data-persona-id'], persona.persona_id);
  assert.match(root.children[0].textContent, new RegExp(persona.persona_name));
  assert.equal(root.children[1], root.kpiDisplay);
  assert.equal(
    root.children.some((child) => child.className === 'analysis__rate'),
    false
  );
});

test('Step2Analysis renders four KPI tiles and top-five responsive table', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Analysis({ persona, document: doc });

  assert.equal(root.kpiDisplay.children.length, 4);
  assert.equal(root.kpiDisplay.children[0].children[0].tagName, 'div');
  assert.equal(root.taskRows.length, Math.min(5, persona.tasks.length));

  const tableWrap = root.children.find(
    (child) => child.className === 'task-breakdown-table-wrap'
  );
  assert.ok(tableWrap);
  assert.equal(tableWrap.children[0], root.breakdownTable);
});

test('Step2Analysis table contains source citations at the bottom', () => {
  const doc = createFakeDocument();
  const root = createStep2Analysis({ persona: personas[0], document: doc });

  assert.match(root.breakdownTable._sourceNote, /O\*NET/);
  assert.match(root.breakdownTable._sourceNote, /Anthropic Economic Index/);
  assert.match(root.breakdownTable._sourceNote, /BLS OEWS/);
});

test('Step2Analysis getFormState exposes the computed dashboard state', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep2Analysis({ persona, document: doc });
  const state = root.getFormState();
  const kpis = computePersonaKpis(persona);

  assert.equal(state.personaId, persona.persona_id);
  assert.equal(state.hoursSaved, kpis.hoursSavedWeekly);
  assert.equal(state.pctSaved, kpis.timeSavedPct);
  assert.equal(state.tasksAutomated, kpis.tasksAutomated);
  assert.equal(state.roiMonthly, kpis.roiMonthly);
});

test('Step2Analysis wires back and next callbacks', () => {
  const doc = createFakeDocument();
  let wentBack = false;
  let wentNext = false;
  const root = createStep2Analysis({
    persona: personas[0],
    document: doc,
    onBack: () => {
      wentBack = true;
    },
    onNext: () => {
      wentNext = true;
    },
  });

  root.backButton.dispatch('click');
  root.nextButton.dispatch('click');

  assert.equal(wentBack, true);
  assert.equal(wentNext, true);
});
