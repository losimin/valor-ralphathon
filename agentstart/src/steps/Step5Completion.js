// AgentStart — Step 5: Completion Screen
//
// Renders the final "Your workspace is ready" screen. Shows green checkmarks
// for every enabled agent with their names, and a summary of the configuration
// so the user can confirm before they consider the wizard done.
//
// Contract:
//   createStep5Completion({ persona, enabledAgents, document, onBack?, onRestart? })
//     - persona:        one entry from data/personas
//     - enabledAgents:  Set or array of agent names that were toggled ON
//     - document:       DOM-like factory; defaults to global document
//     - onBack:         optional callback to go back to Step 4
//     - onRestart:      optional callback to restart the wizard
//   Returns the root element.

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'Step5Completion: no document provided and no global document'
  );
}

function createStep5Completion({
  persona,
  enabledAgents,
  document: docArg,
  onBack,
  onRestart,
} = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('Step5Completion: `persona` is required');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('Step5Completion: `persona.tasks` must be an array');
  }
  const doc = resolveDocument(docArg);

  // Normalise enabledAgents to a Set for O(1) lookup, tolerating both arrays
  // and Sets from callers.
  const enabledSet =
    enabledAgents instanceof Set
      ? enabledAgents
      : new Set(enabledAgents || []);

  const root = doc.createElement('section');
  root.className = 'step step--completion';
  root.setAttribute('data-step', '5');
  root.setAttribute('data-persona-id', String(persona.persona_id ?? ''));

  // Hero checkmark.
  const hero = doc.createElement('div');
  hero.className = 'completion__hero';

  const check = doc.createElement('div');
  check.className = 'completion__check';
  check.textContent = '✓';
  hero.appendChild(check);

  const heading = doc.createElement('h1');
  heading.className = 'step__heading completion__heading';
  heading.textContent = 'Your workspace is ready';
  hero.appendChild(heading);

  const summary = doc.createElement('p');
  summary.className = 'completion__summary';
  const totalAgents = persona.tasks.length;
  const enabledCount = persona.tasks.filter((t) =>
    enabledSet.has(t.agent_name)
  ).length;
  summary.textContent =
    `${enabledCount} of ${totalAgents} agents enabled ` +
    `for ${persona.persona_name}`;
  hero.appendChild(summary);

  root.appendChild(hero);

  // Agent list with checkmarks.
  const list = doc.createElement('ul');
  list.className = 'completion__agents';
  root.appendChild(list);

  persona.tasks.forEach((task) => {
    const isEnabled = enabledSet.has(task.agent_name);

    const item = doc.createElement('li');
    item.className = 'completion__agent';
    item.setAttribute('data-agent-name', task.agent_name);
    item.setAttribute('data-enabled', isEnabled ? 'true' : 'false');

    const icon = doc.createElement('span');
    icon.className =
      'completion__agent-icon' +
      (isEnabled
        ? ' completion__agent-icon--enabled'
        : ' completion__agent-icon--disabled');
    icon.textContent = isEnabled ? '✓' : '—';
    item.appendChild(icon);

    const label = doc.createElement('span');
    label.className = 'completion__agent-name';
    label.textContent = task.agent_name;
    item.appendChild(label);

    const role = doc.createElement('span');
    role.className = 'completion__agent-task';
    role.textContent = task.task_name;
    item.appendChild(role);

    list.appendChild(item);
  });

  // Navigation row.
  const nav = doc.createElement('div');
  nav.className = 'step__nav';

  if (typeof onBack === 'function') {
    const back = doc.createElement('button');
    back.className = 'step__back';
    back.setAttribute('type', 'button');
    back.textContent = '← Back to config';
    back.addEventListener('click', () => onBack());
    nav.appendChild(back);
    root.backButton = back;
  }

  if (typeof onRestart === 'function') {
    const restart = doc.createElement('button');
    restart.className = 'step__next step__next--primary';
    restart.setAttribute('type', 'button');
    restart.textContent = 'Start over';
    restart.addEventListener('click', () => onRestart());
    nav.appendChild(restart);
    root.restartButton = restart;
  }

  root.appendChild(nav);

  root.persona = persona;
  root.agentItems = Array.from(list.children);

  // ── Form state for save-on-exit persistence ────────────────────────────
  //
  // Captures the final workspace configuration so it can be restored if the
  // user navigates back and returns to Step 5.
  root.getFormState = () => ({
    personaId: persona.persona_id,
    enabledAgentNames: Array.from(enabledSet),
    totalAgentCount: persona.tasks.length,
    enabledCount: persona.tasks.filter((t) => enabledSet.has(t.agent_name))
      .length,
  });

  return root;
}

module.exports = { createStep5Completion };
