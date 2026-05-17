// Tests for the SimulatedAgentRun module.
//
// Verifies that:
//   1. Every persona advertises exactly 2 demo-capable tasks (10 total).
//   2. runSimulatedAgent returns the correct hardcoded context/response pair
//      for each supported (persona, task) combination, with no cross-talk
//      between personas.
//   3. The module rejects unknown personas, unknown tasks, and tasks that
//      do not have a demo configured.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runSimulatedAgent,
  listSimulatedAgentRuns,
} = require('../simulatedAgentRun');
const { personas } = require('../../data/personas');
const { taskIdFor } = require('../../components/WorkflowDiagram');

test('catalog exposes exactly 2 demos per persona (10 total)', () => {
  const runs = listSimulatedAgentRuns();
  assert.equal(runs.length, 10);
  const byPersona = new Map();
  for (const r of runs) {
    byPersona.set(r.persona_id, (byPersona.get(r.persona_id) || 0) + 1);
  }
  assert.equal(byPersona.size, 5);
  for (const [persona_id, count] of byPersona) {
    assert.equal(count, 2, `persona ${persona_id} should have 2 demos`);
  }
});

test('runSimulatedAgent returns the correct context/response for each supported task', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      if (!task.has_demo) continue;
      const taskId = taskIdFor(task);
      const result = runSimulatedAgent({
        personaId: persona.persona_id,
        taskId,
      });
      assert.equal(result.persona_id, persona.persona_id);
      assert.equal(result.task_id, taskId);
      assert.equal(result.task_name, task.task_name);
      assert.equal(result.agent_name, task.agent_name);
      // Identity comparison guarantees we returned the exact hardcoded
      // payload from the seed rather than a coincidentally-equal object.
      assert.equal(result.context, task.demo_context);
      assert.equal(result.response, task.demo_response);
    }
  }
});

test('runSimulatedAgent does not return another persona\'s demo data', () => {
  // Pair every demo task with every other persona and confirm we either
  // throw (task id not on that persona) or return that persona's own demo —
  // never a foreign persona's payload.
  const runs = listSimulatedAgentRuns();
  for (const run of runs) {
    for (const persona of personas) {
      if (persona.persona_id === run.persona_id) continue;
      const ownsTask = persona.tasks.some((t) => taskIdFor(t) === run.task_id);
      if (ownsTask) {
        // Extremely unlikely (task names are persona-specific), but if a
        // collision ever exists, the result must belong to *this* persona.
        const result = runSimulatedAgent({
          personaId: persona.persona_id,
          taskId: run.task_id,
        });
        assert.equal(result.persona_id, persona.persona_id);
      } else {
        assert.throws(
          () =>
            runSimulatedAgent({
              personaId: persona.persona_id,
              taskId: run.task_id,
            }),
          /unknown task/
        );
      }
    }
  }
});

test('runSimulatedAgent rejects unknown personas and unknown tasks', () => {
  assert.throws(
    () => runSimulatedAgent({ personaId: 'nope', taskId: 'anything' }),
    /unknown persona/
  );
  assert.throws(
    () =>
      runSimulatedAgent({ personaId: 'editor', taskId: 'not-a-real-task' }),
    /unknown task/
  );
});

test('runSimulatedAgent rejects tasks that have no demo configured', () => {
  // Find a task on any persona where has_demo is false and confirm the
  // module refuses to fabricate a run for it.
  let sampled = false;
  for (const persona of personas) {
    for (const task of persona.tasks) {
      if (task.has_demo) continue;
      sampled = true;
      assert.throws(
        () =>
          runSimulatedAgent({
            personaId: persona.persona_id,
            taskId: taskIdFor(task),
          }),
        /no demo configured/
      );
    }
  }
  assert.ok(sampled, 'expected at least one non-demo task in the seed');
});

test('runSimulatedAgent validates required arguments', () => {
  assert.throws(() => runSimulatedAgent(), /personaId/);
  assert.throws(() => runSimulatedAgent({ personaId: 'editor' }), /taskId/);
  assert.throws(
    () => runSimulatedAgent({ personaId: '', taskId: 'x' }),
    /personaId/
  );
});
