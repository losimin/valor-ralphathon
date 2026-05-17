// AgentStart — AgentToggle component
//
// Step 4 control: renders a single agent row with a toggle switch reflecting
// whether the agent will be deployed. The toggle is controllable — callers
// pass an initial `enabled` boolean and an `onChange` callback that fires with
// the new state every time the user flips the switch. The component is
// framework-agnostic and accepts a DOM-like `document` factory so it can run
// under the Node test runner with a tiny stub (same pattern as PersonaCard).
//
// Contract:
//   createAgentToggle({ agent, enabled, onChange, document })
//     - agent:     { agent_name, agent_description?, automation_confidence? }
//     - enabled:   initial on/off state (boolean)
//     - onChange:  function(nextEnabled, agent) invoked on each toggle
//     - document:  DOM-like factory (defaults to global document when present)
//   Returns the root element. The element also exposes a `toggle()` helper so
//   tests can simulate user interaction without depending on a click event
//   bubbling through nested children.

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error('AgentToggle: no document provided and no global document');
}

function createAgentToggle({
  agent,
  enabled = false,
  onChange,
  document: docArg,
} = {}) {
  if (!agent || typeof agent !== 'object') {
    throw new Error('AgentToggle: `agent` is required');
  }
  if (typeof onChange !== 'function') {
    throw new Error('AgentToggle: `onChange` must be a function');
  }

  const doc = resolveDocument(docArg);
  let state = Boolean(enabled);

  const root = doc.createElement('div');
  root.className = 'agent-toggle';
  root.setAttribute('data-agent-name', String(agent.agent_name ?? ''));
  root.setAttribute('data-enabled', state ? 'true' : 'false');

  const label = doc.createElement('span');
  label.className = 'agent-toggle__label';
  label.textContent = agent.agent_name ?? '';
  root.appendChild(label);

  if (agent.agent_description) {
    const desc = doc.createElement('p');
    desc.className = 'agent-toggle__description';
    desc.textContent = agent.agent_description;
    root.appendChild(desc);
  }

  const button = doc.createElement('button');
  button.className = 'agent-toggle__switch';
  button.setAttribute('type', 'button');
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-checked', state ? 'true' : 'false');
  button.textContent = state ? 'On' : 'Off';
  root.appendChild(button);

  function setState(next) {
    const normalized = Boolean(next);
    if (normalized === state) return;
    state = normalized;
    root.setAttribute('data-enabled', state ? 'true' : 'false');
    button.setAttribute('aria-checked', state ? 'true' : 'false');
    button.textContent = state ? 'On' : 'Off';
    onChange(state, agent);
  }

  function toggle() {
    setState(!state);
  }

  button.addEventListener('click', toggle);

  // Expose imperative helpers for tests and parent containers. These are
  // attached to the root element so the public surface stays a single node.
  root.toggle = toggle;
  root.setEnabled = setState;
  root.isEnabled = () => state;

  return root;
}

module.exports = { createAgentToggle };
