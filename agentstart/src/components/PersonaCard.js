// AgentStart — PersonaCard component
//
// Renders a single persona's name, role, and icon into a clickable card.
// Designed to be framework-agnostic for this prototype: callers pass any
// `document`-like object that implements `createElement(tag)` returning a node
// with `textContent`, `className`, `setAttribute`, `appendChild`, and
// `addEventListener`. The browser `document` satisfies this directly; tests
// supply a minimal stub.
//
// Contract:
//   createPersonaCard({ persona, onSelect, document })
//     - persona:   { persona_id, persona_name, role?, hourly_rate? }
//     - onSelect:  function invoked with the persona when the card is clicked
//     - document:  DOM-like factory (defaults to global document when present)
//   Returns the root element.

// Per-persona icons derived from the hardcoded persona data. Each persona_id
// maps to a role-appropriate emoji so the selection grid has immediate visual
// differentiation without external assets.
const PERSONA_ICONS = {
  editor: '\u{1F4DD}',              // 📝 memo
  financial_advisor: '\u{1F4CA}',   // 📊 bar chart
  teacher: '\u{1F4DA}',             // 📚 books
  project_manager: '\u{1F4CB}',     // 📋 clipboard
  customer_service_rep: '\u{1F4AC}', // 💬 speech balloon
};

// Human-readable role category labels for the card subtitle. These provide
// domain context beyond the persona_name alone.
const PERSONA_ROLES = {
  editor: 'Content & Publishing',
  financial_advisor: 'Wealth Management',
  teacher: 'Education',
  project_manager: 'Operations',
  customer_service_rep: 'Support & Service',
};

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error('PersonaCard: no document provided and no global document');
}

function getIcon(personaId) {
  return PERSONA_ICONS[personaId] ?? '\u{1F4CC}'; // 📌 pushpin fallback
}

function getRole(persona) {
  // Prefer an explicit role field on the persona, then the mapped role
  // category, then fall back to persona_name.
  if (persona.role) return persona.role;
  return PERSONA_ROLES[persona.persona_id] ?? persona.persona_name ?? '';
}

function createPersonaCard({ persona, onSelect, document: docArg } = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('PersonaCard: `persona` is required');
  }
  if (typeof onSelect !== 'function') {
    throw new Error('PersonaCard: `onSelect` must be a function');
  }

  const doc = resolveDocument(docArg);

  const root = doc.createElement('button');
  root.className = 'persona-card';
  root.setAttribute('type', 'button');
  root.setAttribute('data-persona-id', String(persona.persona_id ?? ''));

  // Icon — visual differentiator rendered above the name
  const icon = doc.createElement('span');
  icon.className = 'persona-card__icon';
  icon.textContent = getIcon(persona.persona_id);
  root.appendChild(icon);

  const name = doc.createElement('h3');
  name.className = 'persona-card__name';
  name.textContent = persona.persona_name ?? '';
  root.appendChild(name);

  const role = doc.createElement('p');
  role.className = 'persona-card__role';
  role.textContent = getRole(persona);
  root.appendChild(role);

  root.addEventListener('click', () => {
    onSelect(persona);
  });

  return root;
}

module.exports = { createPersonaCard, PERSONA_ICONS, PERSONA_ROLES };
