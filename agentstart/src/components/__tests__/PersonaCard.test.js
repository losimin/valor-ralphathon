// Unit tests for PersonaCard.
// Uses Node's built-in test runner with a minimal DOM stub so the suite has
// no external dependencies.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPersonaCard,
  PERSONA_ICONS,
  PERSONA_ROLES,
} = require('../PersonaCard');

// Tiny DOM-like factory: enough surface area for PersonaCard to render and
// for tests to inspect the resulting tree and dispatch a click.
function createFakeDocument() {
  function makeNode(tagName) {
    const listeners = {};
    return {
      tagName,
      children: [],
      attributes: {},
      className: '',
      textContent: '',
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
      addEventListener(event, handler) {
        (listeners[event] = listeners[event] || []).push(handler);
      },
      dispatch(event) {
        (listeners[event] || []).forEach((h) => h());
      },
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

// Walk the element tree and collect every textContent value so assertions can
// confirm that name/role/icon appear somewhere within the rendered card.
function collectText(node) {
  const out = [];
  if (node.textContent) out.push(node.textContent);
  for (const child of node.children) out.push(...collectText(child));
  return out;
}

function findChildByClassName(node, className) {
  if (node.className === className) return node;
  for (const child of node.children) {
    const found = findChildByClassName(child, className);
    if (found) return found;
  }
  return null;
}

const samplePersona = {
  persona_id: 'editor',
  persona_name: 'Editor',
  hourly_rate: 36,
};

test('PersonaCard renders the persona name, role, and icon', () => {
  const doc = createFakeDocument();
  const card = createPersonaCard({
    persona: samplePersona,
    onSelect: () => {},
    document: doc,
  });

  const texts = collectText(card);
  assert.ok(
    texts.includes('Editor'),
    `expected rendered card to include persona name; got ${JSON.stringify(texts)}`
  );
  assert.ok(
    texts.includes(PERSONA_ROLES.editor),
    `expected rendered card to include role "${PERSONA_ROLES.editor}"; got ${JSON.stringify(texts)}`
  );
  assert.ok(
    texts.includes(PERSONA_ICONS.editor),
    `expected rendered card to include icon "${PERSONA_ICONS.editor}"; got ${JSON.stringify(texts)}`
  );
  assert.equal(card.attributes['data-persona-id'], 'editor');
  assert.equal(card.className, 'persona-card');
});

test('PersonaCard renders an icon element with correct class', () => {
  const doc = createFakeDocument();
  const card = createPersonaCard({
    persona: samplePersona,
    onSelect: () => {},
    document: doc,
  });

  const iconNode = findChildByClassName(card, 'persona-card__icon');
  assert.ok(iconNode, 'expected an element with class persona-card__icon');
  assert.equal(iconNode.tagName, 'span');
  assert.equal(iconNode.textContent, PERSONA_ICONS.editor);
});

test('PersonaCard uses role from persona object when provided', () => {
  const doc = createFakeDocument();
  const personaWithRole = {
    persona_id: 'custom',
    persona_name: 'Custom Role',
    role: 'Explicit Role Title',
  };
  const card = createPersonaCard({
    persona: personaWithRole,
    onSelect: () => {},
    document: doc,
  });

  const texts = collectText(card);
  assert.ok(
    texts.includes('Explicit Role Title'),
    `expected explicit role to appear; got ${JSON.stringify(texts)}`
  );
  assert.ok(
    texts.includes('Custom Role'),
    `expected persona_name to appear; got ${JSON.stringify(texts)}`
  );
});

test('PersonaCard renders correct icons for all five personas', () => {
  const personaIds = [
    'editor',
    'financial_advisor',
    'teacher',
    'project_manager',
    'customer_service_rep',
  ];

  for (const id of personaIds) {
    const doc = createFakeDocument();
    const card = createPersonaCard({
      persona: { persona_id: id, persona_name: id },
      onSelect: () => {},
      document: doc,
    });

    const iconNode = findChildByClassName(card, 'persona-card__icon');
    const expectedIcon = PERSONA_ICONS[id];
    assert.ok(iconNode, `missing icon for ${id}`);
    assert.equal(
      iconNode.textContent,
      expectedIcon,
      `wrong icon for ${id}: expected "${expectedIcon}", got "${iconNode.textContent}"`
    );
  }
});

test('PersonaCard invokes onSelect with the persona when clicked', () => {
  const doc = createFakeDocument();
  const calls = [];
  const card = createPersonaCard({
    persona: samplePersona,
    onSelect: (p) => calls.push(p),
    document: doc,
  });

  card.dispatch('click');

  assert.equal(calls.length, 1, 'onSelect should fire exactly once per click');
  assert.equal(calls[0], samplePersona, 'onSelect should receive the persona');
  // Sub-AC 2: callback must surface the persona id on click. Asserting on the
  // id explicitly guards against accidental refactors that drop persona_id
  // from the payload while still passing an object.
  assert.equal(
    calls[0].persona_id,
    'editor',
    'onSelect payload must expose the persona id'
  );
});

test('PersonaCard click handler is wired only after a real click', () => {
  // Guards against the regression where onSelect is invoked during render.
  const doc = createFakeDocument();
  let called = false;
  createPersonaCard({
    persona: samplePersona,
    onSelect: () => {
      called = true;
    },
    document: doc,
  });
  assert.equal(called, false, 'render alone must not trigger onSelect');
});

test('PersonaCard validates required arguments', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createPersonaCard({ onSelect: () => {}, document: doc }),
    /persona/
  );
  assert.throws(
    () => createPersonaCard({ persona: samplePersona, document: doc }),
    /onSelect/
  );
});
