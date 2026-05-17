// Tests for Step5Completion — the final "Your workspace is ready" screen.
//
// AC 5 requires the screen to:
//   1. Render the headline "Your workspace is ready".
//   2. Render one checkmark per enabled agent, each labelled with the agent's
//      name (so the user can confirm exactly which agents are live).
//   3. Visually differentiate disabled agents (no checkmark / dash icon).
//   4. Work for every one of the five hardcoded personas.
//
// These tests run the real Step5Completion factory against the real persona
// data so a regression in either component surfaces here.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStep5Completion } = require('../Step5Completion');
const { personas } = require('../../data/personas');

// Minimal DOM stub — same pattern as sibling step tests so behaviour matches
// what the real wizard sees.
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

function collectText(node, acc = []) {
  if (!node) return acc;
  if (node.textContent) acc.push(node.textContent);
  (node.children || []).forEach((child) => collectText(child, acc));
  return acc;
}

test('Step5Completion: heading reads "Your workspace is ready"', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const enabled = persona.tasks.map((t) => t.agent_name);
    const root = createStep5Completion({
      persona,
      enabledAgents: enabled,
      document: doc,
    });

    const text = collectText(root).join(' ');
    assert.match(
      text,
      /Your workspace is ready/i,
      `persona ${persona.persona_id}: heading missing`
    );
  }
});

test('Step5Completion: shows a check icon and agent name for every enabled agent', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    // Enable only the first two agents to verify discrimination.
    const enabledList = persona.tasks.slice(0, 2).map((t) => t.agent_name);
    const enabledSet = new Set(enabledList);

    const root = createStep5Completion({
      persona,
      enabledAgents: enabledList,
      document: doc,
    });

    assert.ok(
      Array.isArray(root.agentItems) && root.agentItems.length === persona.tasks.length,
      `persona ${persona.persona_id}: should expose one item per task`
    );

    for (const item of root.agentItems) {
      const agentName = item.attributes['data-agent-name'];
      const isEnabledAttr = item.attributes['data-enabled'] === 'true';

      // Item must carry the agent name as visible text somewhere.
      const itemText = collectText(item).join(' ');
      assert.ok(
        itemText.includes(agentName),
        `persona ${persona.persona_id}: agent "${agentName}" name must appear`
      );

      if (enabledSet.has(agentName)) {
        assert.equal(
          isEnabledAttr,
          true,
          `agent "${agentName}" should be enabled`
        );
        const checkIcon = item.children.find(
          (c) =>
            typeof c.className === 'string' &&
            c.className.includes('completion__agent-icon--enabled')
        );
        assert.ok(checkIcon, `enabled agent "${agentName}" missing check icon`);
        assert.equal(
          checkIcon.textContent,
          '✓',
          `enabled agent "${agentName}" check icon must be ✓`
        );
      } else {
        assert.equal(
          isEnabledAttr,
          false,
          `agent "${agentName}" should be disabled`
        );
        const disabledIcon = item.children.find(
          (c) =>
            typeof c.className === 'string' &&
            c.className.includes('completion__agent-icon--disabled')
        );
        assert.ok(disabledIcon, `disabled agent "${agentName}" missing icon`);
      }
    }
  }
});

test('Step5Completion: summary reports correct enabled / total counts', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const enabledList = persona.tasks.slice(0, 2).map((t) => t.agent_name);

  const root = createStep5Completion({
    persona,
    enabledAgents: enabledList,
    document: doc,
  });

  const text = collectText(root).join(' ');
  assert.match(
    text,
    new RegExp(`${enabledList.length}\\s+of\\s+${persona.tasks.length}`),
    'summary must show "<enabled> of <total> agents enabled"'
  );
  assert.match(
    text,
    new RegExp(persona.persona_name),
    'summary must mention the persona name'
  );
});

test('Step5Completion: works for an empty enabled set (all disabled)', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep5Completion({
    persona,
    enabledAgents: [],
    document: doc,
  });

  for (const item of root.agentItems) {
    assert.equal(
      item.attributes['data-enabled'],
      'false',
      'all items should be disabled when no agents are enabled'
    );
  }
});

test('Step5Completion: tolerates Set input for enabledAgents', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const enabledSet = new Set([persona.tasks[0].agent_name]);

  const root = createStep5Completion({
    persona,
    enabledAgents: enabledSet,
    document: doc,
  });

  const firstItem = root.agentItems[0];
  assert.equal(firstItem.attributes['data-enabled'], 'true');
});

test('Step5Completion: onBack and onRestart callbacks wire to buttons', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  let backCalls = 0;
  let restartCalls = 0;

  const root = createStep5Completion({
    persona,
    enabledAgents: [],
    document: doc,
    onBack: () => backCalls++,
    onRestart: () => restartCalls++,
  });

  assert.ok(root.backButton, 'back button should exist when onBack provided');
  assert.ok(root.restartButton, 'restart button should exist when onRestart provided');

  root.backButton.dispatch('click');
  assert.equal(backCalls, 1);

  root.restartButton.dispatch('click');
  assert.equal(restartCalls, 1);
});

test('Step5Completion: persona argument is required', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createStep5Completion({ document: doc }),
    /persona.*required/i
  );
});

test('Step5Completion: data-step attribute is 5', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const root = createStep5Completion({
    persona,
    enabledAgents: [],
    document: doc,
  });
  assert.equal(root.attributes['data-step'], '5');
  assert.equal(root.attributes['data-persona-id'], persona.persona_id);
});
