// AgentStart — agent details data module
//
// Exposes pre-filled agent configurations (name, description, confidence,
// enabled-by-default flag, and demo presence) for every task across all five
// personas. Sourced from `personas.js` so a single source of truth is
// preserved while downstream Step 3 (workflow diagram) and Step 4 (config)
// can consume a flat, agent-centric view without re-deriving fields.

const { personas, CONFIDENCE_THRESHOLD } = require('./personas');

const REQUIRED_AGENT_KEYS = [
  'persona_id',
  'persona_name',
  'task_name',
  'agent_name',
  'agent_description',
  'automation_confidence',
  'agent_enabled',
  'has_demo',
];

/**
 * Flat list of every agent across every persona. Each row carries the
 * persona context so consumers can group or filter without joining.
 */
const agents = personas.flatMap((p) =>
  p.tasks.map((t) => ({
    persona_id: p.persona_id,
    persona_name: p.persona_name,
    task_name: t.task_name,
    agent_name: t.agent_name,
    agent_description: t.agent_description,
    automation_confidence: t.automation_confidence,
    agent_enabled: t.agent_enabled,
    has_demo: t.has_demo,
  }))
);

/**
 * Agents indexed by persona_id so Step 4 (Agent Config) can render
 * persona-scoped toggle lists without a full scan.
 */
const agentsByPersona = personas.reduce((acc, p) => {
  acc[p.persona_id] = agents.filter((a) => a.persona_id === p.persona_id);
  return acc;
}, {});

/**
 * Return the pre-filled agent config rows for a given persona.
 * Throws on unknown persona so callers fail loudly rather than silently
 * rendering an empty config screen.
 */
function getAgentsForPersona(personaId) {
  const list = agentsByPersona[personaId];
  if (!list) {
    throw new Error(`Unknown persona_id: ${personaId}`);
  }
  return list;
}

module.exports = {
  agents,
  agentsByPersona,
  getAgentsForPersona,
  REQUIRED_AGENT_KEYS,
  CONFIDENCE_THRESHOLD,
};
