// AgentStart — Step 1: Persona Select
//
// Renders the persona-selection grid as the wizard's opening screen. Delegates
// grid rendering to the PersonaGrid component so layout and card creation stay
// separately testable.
//
// Contract:
//   createStep1PersonaSelect({ onSelect, document, personas? })
//     - onSelect: function invoked with the chosen persona when a card is clicked
//     - document: DOM-like factory; defaults to global document when present
//     - personas: optional override (used by tests); defaults to the data module
//   Returns the root element. The root carries a `cards` array reference and a
//   `grid` reference for ease of inspection in tests.

const { personas: defaultPersonas } = require('../data/personas');
const { createPersonaGrid } = require('../components/PersonaGrid');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'Step1PersonaSelect: no document provided and no global document'
  );
}

function createStep1PersonaSelect({
  onSelect,
  document: docArg,
  personas = defaultPersonas,
} = {}) {
  if (typeof onSelect !== 'function') {
    throw new Error('Step1PersonaSelect: `onSelect` must be a function');
  }
  if (!Array.isArray(personas)) {
    throw new Error('Step1PersonaSelect: `personas` must be an array');
  }

  const doc = resolveDocument(docArg);

  const root = doc.createElement('section');
  root.className = 'step step--persona-select';
  root.setAttribute('data-step', '1');

  const heading = doc.createElement('h1');
  heading.className = 'step__heading';
  heading.textContent = 'Choose your role';
  root.appendChild(heading);

  const subheading = doc.createElement('p');
  subheading.className = 'step__subheading';
  subheading.textContent =
    'AgentStart audits your weekly workflow and recommends AI agents tailored to your role.';
  root.appendChild(subheading);

  // Delegate grid rendering to the PersonaGrid component.
  const grid = createPersonaGrid({
    personas,
    onSelect,
    document: doc,
  });
  root.appendChild(grid);

  // Expose the rendered card list and grid on the root for tests and
  // downstream code that needs to inspect or focus the grid.
  root.cards = grid.cards;
  root.grid = grid;

  // ── Form state for save-on-exit persistence ────────────────────────────
  //
  // Step 1 has no mutable form controls, but getFormState() is provided for
  // consistency with the save-on-exit contract so the wizard controller can
  // uniformly call it on every step before navigation.
  root.getFormState = () => ({
    personaCardsShown: true,
    personaCount: personas.length,
  });

  return root;
}

module.exports = { createStep1PersonaSelect };
