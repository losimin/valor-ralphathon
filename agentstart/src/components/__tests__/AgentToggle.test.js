// Unit tests for AgentToggle. Uses a minimal DOM stub so the suite has no
// external dependencies — matches the pattern used by PersonaCard.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createAgentToggle } = require('../AgentToggle');

function createFakeDocument() {
  function makeNode(tagName) {
    const listeners = {};
    return {
      tagName,
      children: [],
      attributes: {},
      className: '',
      textContent: '',
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

function findByClass(node, className) {
  if (node.className === className) return node;
  for (const child of node.children) {
    const hit = findByClass(child, className);
    if (hit) return hit;
  }
  return null;
}

const sampleAgent = {
  agent_name: 'Draft Polisher',
  agent_description: 'Cleans up early drafts for tone and clarity.',
  automation_confidence: 88,
};

test('AgentToggle renders agent name, description, and initial state', () => {
  const doc = createFakeDocument();
  const root = createAgentToggle({
    agent: sampleAgent,
    enabled: true,
    onChange: () => {},
    document: doc,
  });

  assert.equal(root.attributes['data-agent-name'], 'Draft Polisher');
  assert.equal(root.attributes['data-enabled'], 'true');
  assert.equal(root.isEnabled(), true);

  const switchBtn = findByClass(root, 'agent-toggle__switch');
  assert.ok(switchBtn, 'switch button should be rendered');
  assert.equal(switchBtn.attributes['aria-checked'], 'true');
  assert.equal(switchBtn.textContent, 'On');

  const label = findByClass(root, 'agent-toggle__label');
  assert.equal(label.textContent, 'Draft Polisher');
});

test('AgentToggle defaults to off when `enabled` is not provided', () => {
  const doc = createFakeDocument();
  const root = createAgentToggle({
    agent: sampleAgent,
    onChange: () => {},
    document: doc,
  });
  assert.equal(root.isEnabled(), false);
  assert.equal(root.attributes['data-enabled'], 'false');
  const switchBtn = findByClass(root, 'agent-toggle__switch');
  assert.equal(switchBtn.attributes['aria-checked'], 'false');
  assert.equal(switchBtn.textContent, 'Off');
});

test('AgentToggle flips state and emits change events on toggle', () => {
  const doc = createFakeDocument();
  const calls = [];
  const root = createAgentToggle({
    agent: sampleAgent,
    enabled: false,
    onChange: (next, agent) => calls.push({ next, agent }),
    document: doc,
  });

  const switchBtn = findByClass(root, 'agent-toggle__switch');

  switchBtn.dispatch('click');
  assert.equal(root.isEnabled(), true, 'first click should turn the agent on');
  assert.equal(switchBtn.attributes['aria-checked'], 'true');
  assert.equal(switchBtn.textContent, 'On');
  assert.equal(root.attributes['data-enabled'], 'true');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].next, true);
  assert.equal(calls[0].agent, sampleAgent);

  switchBtn.dispatch('click');
  assert.equal(root.isEnabled(), false, 'second click should turn it off');
  assert.equal(switchBtn.attributes['aria-checked'], 'false');
  assert.equal(switchBtn.textContent, 'Off');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].next, false);
});

test('AgentToggle render alone does not emit a change event', () => {
  const doc = createFakeDocument();
  let called = false;
  createAgentToggle({
    agent: sampleAgent,
    enabled: true,
    onChange: () => {
      called = true;
    },
    document: doc,
  });
  assert.equal(called, false, 'onChange must not fire during initial render');
});

test('AgentToggle.setEnabled is idempotent and only fires on real changes', () => {
  const doc = createFakeDocument();
  const calls = [];
  const root = createAgentToggle({
    agent: sampleAgent,
    enabled: false,
    onChange: (next) => calls.push(next),
    document: doc,
  });

  root.setEnabled(false); // no-op, already off
  assert.equal(calls.length, 0);

  root.setEnabled(true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], true);

  root.setEnabled(true); // no-op, already on
  assert.equal(calls.length, 1);
});

test('AgentToggle validates required arguments', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createAgentToggle({ onChange: () => {}, document: doc }),
    /agent/
  );
  assert.throws(
    () => createAgentToggle({ agent: sampleAgent, document: doc }),
    /onChange/
  );
});
