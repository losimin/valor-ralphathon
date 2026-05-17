// Unit tests for AgentDescriptionCard.
// Uses Node's built-in test runner with the same minimal DOM stub pattern as
// the other component tests, so no external deps are required.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAgentDescriptionCard,
} = require('../AgentDescriptionCard');
const { taskIdFor } = require('../WorkflowDiagram');
const { personas } = require('../../data/personas');

function createFakeDocument() {
  function makeNode(tagName) {
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
      addEventListener() {},
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

function collectText(node) {
  let out = node.textContent || '';
  for (const child of node.children) out += ' ' + collectText(child);
  return out;
}

test('renders the hardcoded agent description for the given task id', () => {
  const editor = personas.find((p) => p.persona_id === 'editor');
  assert.ok(editor, 'editor persona must exist in seed data');

  const copyeditTask = editor.tasks.find(
    (t) => t.task_name === 'Copyedit drafts for grammar and style'
  );
  assert.ok(copyeditTask, 'copyedit task must exist in seed data');
  const taskId = taskIdFor(copyeditTask);

  const doc = createFakeDocument();
  const card = createAgentDescriptionCard({
    persona: editor,
    taskId,
    document: doc,
  });

  assert.equal(card.tagName, 'article');
  assert.equal(card.attributes['data-task-id'], taskId);
  assert.ok(
    !card.className.includes('agent-description-card--empty'),
    'should not be in empty state when task is found'
  );

  const text = collectText(card);
  // The agent description from the seed must appear verbatim — this is the
  // contract: given a task id, render the correct hardcoded description.
  assert.ok(
    text.includes(copyeditTask.agent_description),
    `description should include hardcoded agent_description; got: ${text}`
  );
  assert.ok(
    text.includes(copyeditTask.agent_name),
    'should display the agent name'
  );
  assert.ok(
    text.includes(copyeditTask.task_name),
    'should reference the task being automated'
  );
  assert.ok(
    text.includes(String(copyeditTask.automation_confidence)),
    'should display automation confidence'
  );
});

test('renders an empty-state placeholder when the task id is unknown', () => {
  const editor = personas.find((p) => p.persona_id === 'editor');
  const doc = createFakeDocument();

  const card = createAgentDescriptionCard({
    persona: editor,
    taskId: 'no-such-task',
    document: doc,
  });

  assert.ok(card.className.includes('agent-description-card--empty'));
  assert.ok(collectText(card).toLowerCase().includes('select a task'));
});

test('looks up tasks correctly across all personas', () => {
  // Spot-check a non-editor persona to confirm the lookup is not hardcoded
  // to the first persona — proves the component is data-driven.
  const cs = personas.find(
    (p) => p.persona_id === 'customer_service_rep'
  );
  assert.ok(cs, 'customer service persona must exist');
  const firstTask = cs.tasks[0];
  const taskId = taskIdFor(firstTask);

  const doc = createFakeDocument();
  const card = createAgentDescriptionCard({
    persona: cs,
    taskId,
    document: doc,
  });

  const text = collectText(card);
  assert.ok(text.includes(firstTask.agent_description));
  assert.ok(text.includes(firstTask.agent_name));
});

test('throws on invalid input', () => {
  assert.throws(() => createAgentDescriptionCard({}), /persona/);
  assert.throws(
    () =>
      createAgentDescriptionCard({
        persona: { tasks: [] },
        document: createFakeDocument(),
      }),
    /taskId/
  );
});
