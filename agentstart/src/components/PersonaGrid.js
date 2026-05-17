// AgentStart — PersonaGrid component
//
// Renders a responsive grid of PersonaCards — one card per persona in the
// supplied array. Keeps layout concerns (grid container and DOM construction)
// separate from PersonaCard's per-card rendering.
//
// Contract:
//   createPersonaGrid({ personas, onSelect, document })
//     - personas:   array of persona objects (each with persona_id, persona_name, etc.)
//     - onSelect:   function invoked with the persona when a card is clicked
//     - document:   DOM-like factory; defaults to global document when present
//   Returns the root element. The root carries a `cards` array of rendered
//   PersonaCard nodes for external inspection (tests, focus management, etc.).

const { createPersonaCard } = require('./PersonaCard');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'PersonaGrid: no document provided and no global document'
  );
}

function createPersonaGrid({ personas, onSelect, document: docArg } = {}) {
  if (!Array.isArray(personas)) {
    throw new Error('PersonaGrid: `personas` must be an array');
  }
  if (typeof onSelect !== 'function') {
    throw new Error('PersonaGrid: `onSelect` must be a function');
  }

  const doc = resolveDocument(docArg);

  const grid = doc.createElement('div');
  grid.className = 'persona-grid';

  const cards = personas.map((persona) => {
    const card = createPersonaCard({ persona, onSelect, document: doc });
    grid.appendChild(card);
    return card;
  });

  // Expose card references on the grid node for tests and downstream code.
  grid.cards = cards;

  return grid;
}

module.exports = { createPersonaGrid };
