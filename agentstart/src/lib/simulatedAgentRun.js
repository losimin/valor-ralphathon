// AgentStart — SimulatedAgentRun module
//
// Returns the hardcoded { context, response } pair for the 2 designated demo
// tasks per persona (10 total across the seed). Step 3 of the wizard invokes
// this when a user clicks a task node that advertises has_demo === true so the
// UI can play back a believable agent run without any real model call.
//
// Contract:
//   runSimulatedAgent({ personaId, taskId })
//     - personaId: persona_id from data/personas (e.g. "editor")
//     - taskId:    stable task id matching taskIdFor(task) from WorkflowDiagram
//   Returns { persona_id, task_id, task_name, agent_name, context, response }.
//   Throws if the persona or task is unknown, or if the task has no demo
//   configured — callers should gate calls on task.has_demo.
//
//   listSimulatedAgentRuns()
//     Returns the full catalog of supported (persona_id, task_id) pairs.
//     Used by the Step 3 UI to decide which nodes light up as "Run demo"
//     and by tests to assert coverage (exactly 2 per persona, 10 total).

const { personas } = require('../data/personas');
const { taskIdFor } = require('../components/WorkflowDiagram');

function findPersona(personaId) {
  const persona = personas.find((p) => p.persona_id === personaId);
  if (!persona) {
    throw new Error(`SimulatedAgentRun: unknown persona "${personaId}"`);
  }
  return persona;
}

function findTask(persona, taskId) {
  const task = persona.tasks.find((t) => taskIdFor(t) === taskId);
  if (!task) {
    throw new Error(
      `SimulatedAgentRun: unknown task "${taskId}" for persona "${persona.persona_id}"`
    );
  }
  return task;
}

function runSimulatedAgent({ personaId, taskId } = {}) {
  if (typeof personaId !== 'string' || !personaId) {
    throw new Error('SimulatedAgentRun: `personaId` is required');
  }
  if (typeof taskId !== 'string' || !taskId) {
    throw new Error('SimulatedAgentRun: `taskId` is required');
  }

  const persona = findPersona(personaId);
  const task = findTask(persona, taskId);

  if (!task.has_demo || !task.demo_context || !task.demo_response) {
    throw new Error(
      `SimulatedAgentRun: task "${taskId}" on persona "${personaId}" has no demo configured`
    );
  }

  return {
    persona_id: persona.persona_id,
    task_id: taskId,
    task_name: task.task_name,
    agent_name: task.agent_name,
    context: task.demo_context,
    response: task.demo_response,
  };
}

function listSimulatedAgentRuns() {
  const runs = [];
  for (const persona of personas) {
    for (const task of persona.tasks) {
      if (task.has_demo) {
        runs.push({
          persona_id: persona.persona_id,
          task_id: taskIdFor(task),
          task_name: task.task_name,
          agent_name: task.agent_name,
        });
      }
    }
  }
  return runs;
}

module.exports = { runSimulatedAgent, listSimulatedAgentRuns };
