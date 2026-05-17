// Unit tests for the agent details data module.
// Runs on Node's built-in test runner: `node --test`.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  agents,
  agentsByPersona,
  getAgentsForPersona,
  REQUIRED_AGENT_KEYS,
  CONFIDENCE_THRESHOLD,
} = require('../agentDetails');

const EXPECTED_PERSONA_IDS = [
  'editor',
  'financial_advisor',
  'teacher',
  'project_manager',
  'customer_service_rep',
];

test('agents are exposed as a non-empty flat array', () => {
  assert.ok(Array.isArray(agents));
  assert.ok(agents.length >= 15, 'expected at least 3 agents per persona');
});

test('every agent row has the required fields populated', () => {
  for (const a of agents) {
    for (const key of REQUIRED_AGENT_KEYS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(a, key),
        `agent for ${a.persona_id || '?'} / ${a.task_name || '?'} is missing key: ${key}`
      );
    }
    assert.equal(typeof a.agent_name, 'string');
    assert.ok(a.agent_name.length > 0, 'agent_name must be non-empty');
    assert.equal(typeof a.agent_description, 'string');
    assert.ok(a.agent_description.length > 0, 'agent_description must be non-empty');
    assert.equal(typeof a.automation_confidence, 'number');
    assert.ok(
      a.automation_confidence >= 0 && a.automation_confidence <= 100,
      'automation_confidence must be 0-100'
    );
    assert.equal(typeof a.agent_enabled, 'boolean');
  }
});

test('all five personas are represented with pre-filled agents', () => {
  for (const personaId of EXPECTED_PERSONA_IDS) {
    const list = agentsByPersona[personaId];
    assert.ok(Array.isArray(list), `${personaId} missing in agentsByPersona`);
    assert.ok(list.length >= 3, `${personaId} should have at least 3 agents`);
    for (const key of REQUIRED_AGENT_KEYS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(list[0], key),
        `${personaId} first agent missing required key: ${key}`
      );
    }
  }
});

test('agent_enabled matches the 80% confidence threshold', () => {
  for (const a of agents) {
    assert.equal(
      a.agent_enabled,
      a.automation_confidence >= CONFIDENCE_THRESHOLD,
      `${a.agent_name} enabled flag inconsistent with confidence`
    );
  }
});

test('each persona has at least one auto-enabled agent', () => {
  for (const personaId of EXPECTED_PERSONA_IDS) {
    const enabled = agentsByPersona[personaId].filter((a) => a.agent_enabled);
    assert.ok(
      enabled.length >= 1,
      `${personaId} must have at least one auto-enabled agent to demo value`
    );
  }
});

test('getAgentsForPersona returns rows and throws on unknown id', () => {
  const editorAgents = getAgentsForPersona('editor');
  assert.ok(editorAgents.length >= 3);
  assert.equal(editorAgents[0].persona_id, 'editor');
  assert.throws(() => getAgentsForPersona('nope'), /Unknown persona_id/);
});
