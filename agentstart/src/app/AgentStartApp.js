// AgentStart — wizard controller
//
// Orchestrates step transitions for the AgentStart prototype. Owns a single
// root container and swaps the currently-mounted step in response to user
// actions. Picking a persona in Step 1 mounts Step 2 with that persona's
// pre-populated analysis content.
//
// Navigation state management (Sub-AC 6.1):
//   - Tracks currentStepIndex (1–5) and maxReachedStep so the user can
//     revisit any previously-visited step via goToStep(n).
//   - goToStep(n) *blocks* navigation to any step index greater than
//     maxReachedStep — forward progression is only possible through the
//     wizard's "Next" buttons (which call advanceToStep internally).
//   - Step nodes are cached so that toggles, task selections, and other
//     in-step state survive back/forward navigation within the cache
//     lifetime (cleared on persona change).
//
// Save-on-exit persistence (Sub-AC 6.3b):
//   - Before every navigation (goToStep, advanceToStep), the current step's
//     form state is persisted to a FormDataStore instance via
//     saveCurrentStepState().
//   - Each step component exposes a getFormState() method that returns a
//     plain serialisable object representing its current interactive state.
//   - The store is scoped by (persona_id, step_index) so form data from
//     different personas never collide.
//   - On persona switch or wizard restart, stale data is cleared from the
//     store so the next session starts fresh.
//
// Restore-on-entry (Sub-AC 6.3c):
//   - When a step is rebuilt after cache invalidation (e.g., advanceToStep
//     deletes the cached node for the target step), buildStepForIndex
//     consults the FormDataStore for previously persisted form state.
//   - If saved data exists AND the step exposes a restoreFormState(data)
//     method, the saved values are applied to the component so interactive
//     state (toggles, task selections, demo runs) survives the rebuild.
//   - Steps retrieved from the in-memory stepCache are NOT restored — the
//     cache itself preserves the live DOM state, so restoration would be
//     redundant and potentially destructive.
//
// Contract:
//   createAgentStartApp({ document, personas?, formDataStore? })
//     - document:      DOM-like factory; defaults to global document
//     - personas:      optional override (used by tests); defaults to the data
//                      module
//     - formDataStore: optional store instance (used by tests to inject a
//                      spy/mock); defaults to creating a fresh FormDataStore
//   Returns the root element. The root exposes:
//     - root.currentStep       reference to the currently mounted step node
//     - root.currentStepIndex  the 1-based index of the current step
//     - root.maxReachedStep    furthest step the user has legitimately visited
//     - root.goToStep(n)       navigate to step n (n ≤ maxReachedStep only)
//     - root.goToStep1()       convenience: navigate back to persona selection
//     - root.selectPersona(p)  programmatic equivalent of clicking a card
//     - root.stepIndicator     reference to the progress-indicator node
//     - root.formDataStore     reference to the FormDataStore instance

const { personas: defaultPersonas, getPersonaById } = require('../data/personas');
const { createStep1PersonaSelect } = require('../steps/Step1PersonaSelect');
const { createStep2Analysis } = require('../steps/Step2Analysis');
const { createStep3Workflow } = require('../steps/Step3Workflow');
const { createStep4Configure } = require('../steps/Step4Configure');
const { createStep5Completion } = require('../steps/Step5Completion');
const { createStepIndicator } = require('../components/StepIndicator');
const { createFormDataStore } = require('../lib/formDataStore');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'AgentStartApp: no document provided and no global document'
  );
}

function createAgentStartApp({
  document: docArg,
  personas = defaultPersonas,
  formDataStore: explicitStore,
} = {}) {
  const doc = resolveDocument(docArg);

  const root = doc.createElement('div');
  root.className = 'agentstart-app';

  // ── Form data store (save-on-exit persistence) ─────────────────────────

  const formDataStore = explicitStore || createFormDataStore();
  root.formDataStore = formDataStore;

  // ── Navigation state ──────────────────────────────────────────────────

  let currentStepIndex = 1;
  let maxReachedStep = 1;
  let selectedPersona = null;

  // Cache of step root nodes keyed by step index (1–5). Cleared when a
  // different persona is selected so stale persona data is never shown.
  let stepCache = {};
  // Cache of persona-specific state keyed by persona_id so that switching
  // personas and coming back restores the previous session.
  let personaSessionCache = {};

  // ── Step indicator (progress bar) ─────────────────────────────────────

  // The StepIndicator component is rebuilt on every navigation change so
  // active/reached/future state always reflects the current wizard position.
  // It delegates click handling to goToStep, which enforces the forward-
  // navigation block (n > maxReachedStep is rejected).

  let stepIndicator = buildStepIndicator();
  root.appendChild(stepIndicator);

  function buildStepIndicator() {
    return createStepIndicator({
      currentStep: currentStepIndex,
      maxReachedStep,
      onStepClick: (n) => root.goToStep(n),
      document: doc,
    });
  }

  function renderStepIndicator() {
    const old = stepIndicator;
    const next = buildStepIndicator();

    // Replace the old indicator with the new one in the DOM tree.
    if (typeof root.replaceChild === 'function') {
      root.replaceChild(next, old);
    } else {
      // Fallback for lightweight test stubs.
      const i = root.children.indexOf(old);
      if (i !== -1) root.children.splice(i, 1, next);
    }
    stepIndicator = next;
    root.stepIndicator = stepIndicator;
  }

  // ── DOM helpers ───────────────────────────────────────────────────────

  // Detach the currently mounted step before mounting the next one. Uses
  // standard DOM APIs when available; falls back to clearing the children
  // array for the lightweight test stub.
  function detachCurrent() {
    if (!root.currentStep) return;
    if (typeof root.removeChild === 'function') {
      try {
        root.removeChild(root.currentStep);
      } catch (_) {
        // Some test stubs do not actually track parent/child relationships.
      }
    }
    // Fallback for stubs that maintain a children array.
    if (Array.isArray(root.children)) {
      const i = root.children.indexOf(root.currentStep);
      if (i !== -1) root.children.splice(i, 1);
    }
    root.currentStep = null;
  }

  function setStepNode(node, stepIndex) {
    detachCurrent();
    root.appendChild(node);
    root.currentStep = node;
    currentStepIndex = stepIndex;
    root.currentStepIndex = stepIndex;
    renderStepIndicator();
  }

  // ── Save-on-exit ──────────────────────────────────────────────────────

  /**
   * Persist the current step's form state to the FormDataStore before
   * navigating away. This is called by both goToStep and advanceToStep
   * so that interactive state (toggles, task selections, demo runs) is
   * never lost on navigation.
   *
   * The form state is scoped by (persona_id, step_index). If no persona
   * is selected or the current step has no getFormState method, this is
   * a no-op.
   */
  function saveCurrentStepState() {
    if (!selectedPersona) return;
    const step = root.currentStep;
    if (!step || typeof step.getFormState !== 'function') return;

    const formState = step.getFormState();
    formDataStore.save(
      selectedPersona.persona_id,
      currentStepIndex,
      formState
    );
  }

  // ── Core navigation API ───────────────────────────────────────────────

  /**
   * Navigate to the given step index. Only allowed if n ≤ maxReachedStep.
   * This is the public API for back-navigation and step-indicator clicks.
   * Forward progression through the wizard must go through advanceToStep(),
   * which is called by each step's "Next" button handler.
   *
   * @param {number} n — 1-based step index (1…5)
   */
  function goToStep(n) {
    if (typeof n !== 'number' || n < 1 || n > 5) return;
    if (n > maxReachedStep) return; // **Block forward navigation**

    if (n === currentStepIndex) return; // Already on this step

    // Persist current step form state before navigating away (Sub-AC 6.3b).
    saveCurrentStepState();

    // If the user is going back from Step 4 or 5, we need to preserve the
    // current step state in the cache. The current step is still referenced
    // in stepCache, so we just need to make sure it hasn't been invalidated.
    let node = stepCache[n];

    if (!node) {
      // Step not yet built — this can happen if the step was evicted or
      // we're recovering from a cache miss.
      node = buildStepForIndex(n);
      stepCache[n] = node;
    }

    setStepNode(node, n);
  }

  /**
   * Advance to a step, updating maxReachedStep if this is the furthest the
   * user has reached. Used internally by Next button handlers. Unlike
   * goToStep, this CAN go beyond the current maxReachedStep.
   *
   * @param {number} n — 1-based step index
   */
  function advanceToStep(n) {
    if (typeof n !== 'number' || n < 1 || n > 5) return;

    // Persist current step form state before navigating away (Sub-AC 6.3b).
    saveCurrentStepState();

    if (n > maxReachedStep) {
      maxReachedStep = n;
      root.maxReachedStep = maxReachedStep;
    }

    // Invalidate any cached future steps since state may have changed
    // (e.g., toggles in Step 4 affect Step 5).
    for (let i = n; i <= 5; i++) {
      delete stepCache[i];
    }

    const node = buildStepForIndex(n);
    stepCache[n] = node;
    setStepNode(node, n);
  }

  // ── Step builder ──────────────────────────────────────────────────────

  function buildStepForIndex(n) {
    let node;
    switch (n) {
      case 1:
        node = buildStep1();
        break;
      case 2:
        node = buildStep2();
        break;
      case 3:
        node = buildStep3();
        break;
      case 4:
        node = buildStep4();
        break;
      case 5:
        node = buildStep5();
        break;
      default:
        throw new Error(`AgentStartApp: unknown step index ${n}`);
    }

    // ── Restore-on-entry (Sub-AC 6.3c) ─────────────────────────────────
    //
    // After building a step, check the FormDataStore for previously saved
    // form state. When data exists and the step supports restoration, the
    // persisted values are loaded into the component so that interactive
    // state (toggles, task selections, demo runs) survives cache
    // invalidation caused by advanceToStep.
    if (
      selectedPersona &&
      typeof node.restoreFormState === 'function'
    ) {
      const saved = formDataStore.retrieve(
        selectedPersona.persona_id,
        n
      );
      if (saved !== undefined) {
        node.restoreFormState(saved);
      }
    }

    return node;
  }

  function buildStep1() {
    return createStep1PersonaSelect({
      onSelect: (persona) => selectPersona(persona),
      document: doc,
      personas,
    });
  }

  function buildStep2() {
    if (!selectedPersona) {
      throw new Error('AgentStartApp: no persona selected for Step 2');
    }
    return createStep2Analysis({
      persona: selectedPersona,
      document: doc,
      onBack: () => goToStep(1),
      onNext: () => advanceToStep(3),
    });
  }

  function buildStep3() {
    if (!selectedPersona) {
      throw new Error('AgentStartApp: no persona selected for Step 3');
    }
    return createStep3Workflow({
      persona: selectedPersona,
      document: doc,
      onBack: () => goToStep(2),
      onNext: () => advanceToStep(4),
    });
  }

  function buildStep4() {
    if (!selectedPersona) {
      throw new Error('AgentStartApp: no persona selected for Step 4');
    }
    const step4 = createStep4Configure({
      persona: selectedPersona,
      document: doc,
      onBack: () => goToStep(3),
      onNext: () => advanceToStep(5),
    });

    // Invalidate the Step 5 cache whenever Step 4 is built fresh, because
    // Step 5's content depends on the current toggle state in Step 4.
    delete stepCache[5];

    return step4;
  }

  function buildStep5() {
    if (!selectedPersona) {
      throw new Error('AgentStartApp: no persona selected for Step 5');
    }

    // Read the enabled agents from the cached Step 4 node. If Step 4 is not
    // cached (edge case), build it transiently to get the state.
    let enabledState = {};
    const cachedStep4 = stepCache[4];
    if (cachedStep4 && typeof cachedStep4.getEnabledState === 'function') {
      enabledState = cachedStep4.getEnabledState();
    }

    // Build the set of enabled agent names.
    const enabledAgentNames = Object.entries(enabledState)
      .filter(([, on]) => on)
      .map(([name]) => name);

    const step5 = createStep5Completion({
      persona: selectedPersona,
      enabledAgents: enabledAgentNames,
      document: doc,
      onBack: () => goToStep(4),
      onRestart: () => restartWizard(),
    });

    return step5;
  }

  // ── Persona selection & restart ───────────────────────────────────────

  /**
   * Select a persona by identifier or whole object. When called with a string
   * (persona_id), the matching persona is looked up from the persona list.
   * When called with an object, it is used directly. In either case the
   * selected-persona state is updated and the wizard advances to Step 2.
   *
   * @param {string|object} personaOrId - persona_id string or full persona object
   */
  function selectPersona(personaOrId) {
    let persona;
    if (typeof personaOrId === 'string') {
      // Delegate string lookups to the canonical data-loading function
      // (Sub-AC 3c). getPersonaById validates the input, throws on unknown
      // IDs, and returns the pre-populated analysis object.
      persona = getPersonaById(personaOrId);
    } else if (personaOrId && typeof personaOrId === 'object') {
      persona = personaOrId;
    } else {
      throw new Error(
        'AgentStartApp: selectPersona requires a persona_id string or persona object'
      );
    }

    selectedPersona = persona;

    // Clear all cached steps so they are rebuilt with the new persona.
    stepCache = {};

    // Persona-specific session persistence: save/restore cache for this
    // persona_id so that switching away and back preserves state.
    if (personaSessionCache[persona.persona_id]) {
      stepCache = personaSessionCache[persona.persona_id].stepCache || {};
      maxReachedStep =
        personaSessionCache[persona.persona_id].maxReachedStep || 1;
    } else {
      maxReachedStep = 1;
    }

    root.maxReachedStep = maxReachedStep;

    advanceToStep(2);
  }

  function restartWizard() {
    // Persist current step form state before restarting (Sub-AC 6.3b).
    saveCurrentStepState();

    // Save the current session before restarting.
    if (selectedPersona) {
      personaSessionCache[selectedPersona.persona_id] = {
        stepCache: { ...stepCache },
        maxReachedStep,
      };
      // Clear form data for this persona so the next session starts fresh.
      formDataStore.clear(selectedPersona.persona_id);
    }

    selectedPersona = null;
    stepCache = {};
    maxReachedStep = 1;
    root.maxReachedStep = maxReachedStep;
    goToStep(1);
  }

  // Save session when navigating back to Step 1 (persona selection).
  // We wrap goToStep1 to also persist the cache and form data store.
  function goToStep1() {
    // Persist current step form state before leaving this persona (Sub-AC 6.3b).
    saveCurrentStepState();

    if (selectedPersona) {
      personaSessionCache[selectedPersona.persona_id] = {
        stepCache: { ...stepCache },
        maxReachedStep,
      };
      // Clear form data for this persona since we're leaving their session.
      formDataStore.clear(selectedPersona.persona_id);
    }
    selectedPersona = null;
    stepCache = {};
    maxReachedStep = 1;
    root.maxReachedStep = maxReachedStep;

    // Build Step 1 fresh so the persona grid is always current.
    const step1 = buildStep1();
    stepCache[1] = step1;
    setStepNode(step1, 1);
  }

  // ── Initialise ────────────────────────────────────────────────────────

  // Build Step 1 and start the wizard.
  stepCache[1] = buildStep1();
  setStepNode(stepCache[1], 1);

  // ── Public API ────────────────────────────────────────────────────────

  root.goToStep = goToStep;
  root.goToStep1 = goToStep1;
  root.selectPersona = selectPersona;
  root.currentStepIndex = currentStepIndex;
  root.maxReachedStep = maxReachedStep;
  root.stepIndicator = stepIndicator;

  return root;
}

module.exports = { createAgentStartApp };
