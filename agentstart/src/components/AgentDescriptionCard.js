// AgentStart — AgentDescriptionCard component
//
// Renders agent details for a single task selected from the Step 3 workflow
// diagram. Given a persona and a task id (derived from task_name using the
// same scheme as WorkflowDiagram.taskIdFor), it surfaces the agent name,
// description, automation confidence, and projected time savings so the user
// can decide whether the agent earns a slot in their workspace.
//
// Contract:
//   createAgentDescriptionCard({ persona, taskId, document })
//     - persona:  { persona_id, tasks: [...] } from data/personas
//     - taskId:   string id matching taskIdFor(task) for one of persona.tasks
//     - document: DOM-like factory (defaults to global document)
//   Returns the root <article> element. If the task id does not match any
//   task on the persona, an empty placeholder element is returned that
//   carries the `agent-description-card--empty` modifier so callers can
//   render a fallback state without special-casing null.

const { taskIdFor } = require('./WorkflowDiagram');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'AgentDescriptionCard: no document provided and no global document'
  );
}

function createAgentDescriptionCard({
  persona,
  taskId,
  document: docArg,
} = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('AgentDescriptionCard: `persona` is required');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('AgentDescriptionCard: `persona.tasks` must be an array');
  }
  if (typeof taskId !== 'string' || !taskId) {
    throw new Error('AgentDescriptionCard: `taskId` must be a non-empty string');
  }

  const doc = resolveDocument(docArg);

  const root = doc.createElement('article');
  root.className = 'agent-description-card';
  root.setAttribute('data-task-id', taskId);

  const task = persona.tasks.find((t) => taskIdFor(t) === taskId);

  if (!task) {
    // Render a stable empty state so callers can simply mount the element
    // without first checking whether the lookup succeeded.
    root.className = 'agent-description-card agent-description-card--empty';
    const empty = doc.createElement('p');
    empty.className = 'agent-description-card__empty';
    empty.textContent = 'Select a task to see its agent.';
    root.appendChild(empty);
    return root;
  }

  // Agent name is the headline — keep it as an h3 to mirror the workflow
  // diagram's node title hierarchy.
  const name = doc.createElement('h3');
  name.className = 'agent-description-card__name';
  name.textContent = task.agent_name || '';
  root.appendChild(name);

  const taskLabel = doc.createElement('p');
  taskLabel.className = 'agent-description-card__task';
  taskLabel.textContent = `For task: ${task.task_name || ''}`;
  root.appendChild(taskLabel);

  const description = doc.createElement('p');
  description.className = 'agent-description-card__description';
  description.textContent = task.agent_description || '';
  root.appendChild(description);

  const confidence = doc.createElement('p');
  confidence.className = 'agent-description-card__confidence';
  confidence.setAttribute(
    'data-confidence',
    String(task.automation_confidence ?? '')
  );
  confidence.textContent = `Automation confidence: ${
    task.automation_confidence ?? 0
  }%`;
  root.appendChild(confidence);

  const savings = doc.createElement('p');
  savings.className = 'agent-description-card__savings';
  savings.textContent = `Projected time saved: ${task.time_saved_pct ?? 0}% (${
    task.current_hours_weekly ?? 0
  }h → ${task.projected_hours_weekly ?? 0}h weekly)`;
  root.appendChild(savings);

  return root;
}

module.exports = { createAgentDescriptionCard };
