// AgentStart — Step 4: Agent Configuration
//
// Renders the configure-agents screen for a selected persona. The container
// maps over the persona's agent details, passes each agent's
// `automation_confidence` through `isAgentEnabledByDefault` to decide the
// initial toggle state, and mounts one `AgentToggle` per agent. Toggle flips
// update an internal state map so callers can read the resulting on/off
// configuration via `root.getEnabledState()`.
//
// Contract:
//   createStep4Configure({ persona, document, onBack?, onNext?, getAgents? })
//     - persona:   one entry from data/personas (must expose persona_id +
//                  persona_name).
//     - document:  DOM-like factory; defaults to global document.
//     - onBack:    optional callback wired to a "Back" button.
//     - onNext:    optional callback wired to a "Next" button.
//     - getAgents: optional override returning the agent list for a persona
//                  id. Defaults to `agentDetails.getAgentsForPersona`. Used
//                  by tests to inject mocked agent lists.
//   Returns the root element. The root exposes:
//     - root.toggles          array of mounted AgentToggle nodes
//     - root.getEnabledState()  { [agent_name]: boolean }

const {
  getAgentsForPersona: defaultGetAgentsForPersona,
} = require('../data/agentDetails');
const {
  isAgentEnabledByDefault,
} = require('../lib/agentToggleDefault');
const { createAgentToggle } = require('../components/AgentToggle');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'Step4Configure: no document provided and no global document'
  );
}

function createStep4Configure({
  persona,
  document: docArg,
  onBack,
  onNext,
  getAgents = defaultGetAgentsForPersona,
} = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('Step4Configure: `persona` is required');
  }
  if (!persona.persona_id) {
    throw new Error('Step4Configure: `persona.persona_id` is required');
  }
  const doc = resolveDocument(docArg);

  const agents = getAgents(persona.persona_id);
  if (!Array.isArray(agents)) {
    throw new Error('Step4Configure: agent list must be an array');
  }

  const root = doc.createElement('section');
  root.className = 'step step--configure';
  root.setAttribute('data-step', '4');
  root.setAttribute('data-persona-id', String(persona.persona_id));

  const heading = doc.createElement('h1');
  heading.className = 'step__heading';
  heading.textContent = `Configure agents for ${persona.persona_name}`;
  root.appendChild(heading);

  const subheading = doc.createElement('p');
  subheading.className = 'step__subheading';
  subheading.textContent =
    'Agents with at least 80% automation confidence are enabled by default. ' +
    'Flip any switch to override.';
  root.appendChild(subheading);

  const list = doc.createElement('div');
  list.className = 'configure__list';
  root.appendChild(list);

  // Track the current on/off state for every agent. Initial values come from
  // the seed-mandated 80%-confidence policy.
  const enabledState = {};

  const toggles = agents.map((agent) => {
    const initial = isAgentEnabledByDefault(agent.automation_confidence);
    enabledState[agent.agent_name] = initial;

    const toggle = createAgentToggle({
      agent,
      enabled: initial,
      onChange: (next) => {
        enabledState[agent.agent_name] = next;
      },
      document: doc,
    });
    list.appendChild(toggle);
    return toggle;
  });

  if (typeof onNext === 'function') {
    const next = doc.createElement('button');
    next.className = 'step__next step__next--primary';
    next.setAttribute('type', 'button');
    next.textContent = 'Finish setup →';
    next.addEventListener('click', () => onNext());
    root.appendChild(next);
    root.nextButton = next;
  }

  if (typeof onBack === 'function') {
    const back = doc.createElement('button');
    back.className = 'step__back';
    back.setAttribute('type', 'button');
    back.textContent = '← Back';
    back.addEventListener('click', () => onBack());
    root.appendChild(back);
    root.backButton = back;
  }

  root.persona = persona;
  root.toggles = toggles;
  root.getEnabledState = () => ({ ...enabledState });

  // ── Form state for save-on-exit persistence ────────────────────────────
  //
  // Delegates to getEnabledState() so the serialised form snapshot is
  // identical to the toggle configuration used by Step 5.
  root.getFormState = () => ({
    enabledState: root.getEnabledState(),
    agentCount: toggles.length,
  });

  // ── Restore-on-entry (Sub-AC 6.3c) ─────────────────────────────────────
  //
  // When the wizard controller rebuilds this step after cache invalidation,
  // this method re-applies the previously saved toggle configuration so the
  // user sees the same enabled/disabled state they left behind.
  root.restoreFormState = (data) => {
    if (!data || !data.enabledState) return;

    for (const toggle of toggles) {
      const agentName = toggle.attributes['data-agent-name'];
      const savedValue = data.enabledState[agentName];
      if (savedValue !== undefined && savedValue !== toggle.isEnabled()) {
        toggle.setEnabled(savedValue);
      }
    }
  };

  return root;
}

module.exports = { createStep4Configure };
