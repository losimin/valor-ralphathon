// Unit tests for WorkflowDiagram.
// Uses Node's built-in test runner with a minimal DOM stub mirroring the
// pattern used in PersonaCard.test.js so no external deps are required.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorkflowDiagram, taskIdFor } = require('../WorkflowDiagram');

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

function collectText(node) {
  const out = [];
  if (node.textContent) out.push(node.textContent);
  for (const child of node.children) out.push(...collectText(child));
  return out;
}

const samplePersona = {
  persona_id: 'editor',
  persona_name: 'Editor',
  tasks: [
    {
      task_name: 'Copyedit drafts for grammar and style',
      task_frequency: 5,
      automation_confidence: 92,
      agent_name: 'Copyedit Agent',
    },
    {
      task_name: 'Fact-check claims and citations',
      task_frequency: 3,
      automation_confidence: 74,
      agent_name: 'Fact-check Agent',
    },
    {
      task_name: 'Schedule editorial calendar',
      task_frequency: 4,
      automation_confidence: 85,
      agent_name: 'Calendar Agent',
    },
  ],
};

test('WorkflowDiagram renders one node per task with confidence scores', () => {
  const doc = createFakeDocument();
  const root = createWorkflowDiagram({
    persona: samplePersona,
    onNodeClick: () => {},
    document: doc,
  });

  assert.equal(root.nodes.length, 3, 'should render one node per task');

  const texts = collectText(root);
  for (const task of samplePersona.tasks) {
    assert.ok(
      texts.includes(task.task_name),
      `expected node for "${task.task_name}" to render its name`
    );
    assert.ok(
      texts.some((t) => t.includes(`${task.automation_confidence}%`)),
      `expected confidence ${task.automation_confidence}% to render`
    );
  }
});

test('WorkflowDiagram orders nodes by descending task_frequency', () => {
  const doc = createFakeDocument();
  const root = createWorkflowDiagram({
    persona: samplePersona,
    onNodeClick: () => {},
    document: doc,
  });

  const ids = root.nodes.map((n) => n.attributes['data-task-id']);
  // Frequencies: Copyedit=5, Schedule=4, Fact-check=3 → descending order.
  assert.deepEqual(ids, [
    'copyedit-drafts-for-grammar-and-style',
    'schedule-editorial-calendar',
    'fact-check-claims-and-citations',
  ]);
});

test('WorkflowDiagram emits click events with the correct task id', () => {
  const doc = createFakeDocument();
  const calls = [];
  const root = createWorkflowDiagram({
    persona: samplePersona,
    onNodeClick: (payload) => calls.push(payload),
    document: doc,
  });

  // Click the second node (Schedule editorial calendar — frequency 4).
  root.nodes[1].dispatch('click');

  assert.equal(calls.length, 1, 'onNodeClick should fire exactly once');
  assert.equal(calls[0].taskId, 'schedule-editorial-calendar');
  assert.equal(calls[0].index, 1);
  assert.equal(calls[0].task.task_name, 'Schedule editorial calendar');

  // Click the first node — confirms the handler discriminates by node.
  root.nodes[0].dispatch('click');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].taskId, 'copyedit-drafts-for-grammar-and-style');
  assert.equal(calls[1].task.automation_confidence, 92);
});

test('WorkflowDiagram does not invoke onNodeClick during render', () => {
  // Guards against the regression where the click handler fires eagerly.
  const doc = createFakeDocument();
  let called = false;
  createWorkflowDiagram({
    persona: samplePersona,
    onNodeClick: () => {
      called = true;
    },
    document: doc,
  });
  assert.equal(called, false, 'render alone must not trigger onNodeClick');
});

test('WorkflowDiagram validates required arguments', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createWorkflowDiagram({ onNodeClick: () => {}, document: doc }),
    /persona/
  );
  assert.throws(
    () =>
      createWorkflowDiagram({
        persona: { persona_id: 'x' },
        onNodeClick: () => {},
        document: doc,
      }),
    /tasks/
  );
  assert.throws(
    () =>
      createWorkflowDiagram({ persona: samplePersona, document: doc }),
    /onNodeClick/
  );
});

test('taskIdFor produces a stable URL-safe slug', () => {
  assert.equal(
    taskIdFor({ task_name: 'Fact-check claims and citations' }),
    'fact-check-claims-and-citations'
  );
  assert.equal(taskIdFor({ task_name: '' }), '');
});
