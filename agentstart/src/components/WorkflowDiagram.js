// AgentStart — WorkflowDiagram component
//
// Renders a persona's tasks as a row of clickable nodes that form a simple
// left-to-right workflow diagram. Each node surfaces the task name, the agent
// designed for it, and its automation confidence score so that Step 3 of the
// wizard can communicate which steps of the workflow an agent will own.
//
// Contract:
//   createWorkflowDiagram({ persona, onNodeClick, document })
//     - persona:      { persona_id, tasks: [...] } from data/personas
//     - onNodeClick:  function invoked with { task, taskId, index } when a
//                     node is clicked. taskId is derived from task_name so
//                     callers can address nodes without relying on array
//                     position.
//     - document:     DOM-like factory (defaults to global document)
//   Returns the root <section> element. The element exposes `nodes` for ease
//   of inspection in tests.
//
// Tasks are rendered in descending `task_frequency` order to match the rest
// of the wizard (Step 2's table uses the same ordering), so the diagram reads
// from highest-leverage task on the left to lowest on the right.

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'WorkflowDiagram: no document provided and no global document'
  );
}

// Stable, URL-safe id for a task derived from its display name. Keeps tests
// readable and avoids leaking array indices into the public click payload.
function taskIdFor(task) {
  return String(task.task_name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createWorkflowDiagram({
  persona,
  onNodeClick,
  document: docArg,
} = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('WorkflowDiagram: `persona` is required');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('WorkflowDiagram: `persona.tasks` must be an array');
  }
  if (typeof onNodeClick !== 'function') {
    throw new Error('WorkflowDiagram: `onNodeClick` must be a function');
  }

  const doc = resolveDocument(docArg);

  const root = doc.createElement('section');
  root.className = 'workflow-diagram';
  root.setAttribute('data-persona-id', String(persona.persona_id ?? ''));

  const heading = doc.createElement('h2');
  heading.className = 'workflow-diagram__heading';
  heading.textContent = 'Agent workflow';
  root.appendChild(heading);

  const list = doc.createElement('ol');
  list.className = 'workflow-diagram__nodes';
  root.appendChild(list);

  // Sort a shallow copy so we never mutate the seed data; Step 2 relies on
  // the same descending-frequency order, so reusing that convention keeps
  // the two screens visually consistent.
  const ordered = persona.tasks
    .slice()
    .sort((a, b) => (b.task_frequency || 0) - (a.task_frequency || 0));

  const nodes = [];

  ordered.forEach((task, index) => {
    const taskId = taskIdFor(task);

    const item = doc.createElement('li');
    item.className = 'workflow-diagram__node-wrap';
    list.appendChild(item);

    const node = doc.createElement('button');
    node.className = 'workflow-diagram__node';
    node.setAttribute('type', 'button');
    node.setAttribute('data-task-id', taskId);
    node.setAttribute('data-node-index', String(index));

    const title = doc.createElement('h3');
    title.className = 'workflow-diagram__node-title';
    title.textContent = task.task_name || '';
    node.appendChild(title);

    const agent = doc.createElement('p');
    agent.className = 'workflow-diagram__node-agent';
    agent.textContent = task.agent_name || '';
    node.appendChild(agent);

    // Confidence score is the headline metric on each node — it determines
    // whether the agent is auto-enabled in Step 4 and is the most useful
    // signal when scanning the diagram.
    const confidence = doc.createElement('p');
    confidence.className = 'workflow-diagram__node-confidence';
    confidence.setAttribute(
      'data-confidence',
      String(task.automation_confidence ?? '')
    );
    confidence.textContent = `${task.automation_confidence ?? 0}% confidence`;
    node.appendChild(confidence);

    node.addEventListener('click', () => {
      onNodeClick({ task, taskId, index });
    });

    item.appendChild(node);
    nodes.push(node);
  });

  root.nodes = nodes;
  return root;
}

module.exports = { createWorkflowDiagram, taskIdFor };
