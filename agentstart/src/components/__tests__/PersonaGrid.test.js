// Unit tests for PersonaGrid.
// Verifies that the component renders exactly one PersonaCard per persona
// supplied — the sub-AC requires exactly 5 cards when fed the full persona list.
// Uses Node's built-in test runner with a minimal DOM stub.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createPersonaGrid } = require('../PersonaGrid');
const { personas } = require('../../data/personas');

// Minimal DOM stub that satisfies PersonaCard's and PersonaGrid's DOM needs:
// createElement returns a lightweight node with children, attributes, className,
// textContent, appendChild, setAttribute, addEventListener, and dispatch.
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

// Helper: collect text content from node tree recursively.
function collectText(node) {
  const out = [];
  if (node.textContent) out.push(node.textContent);
  for (const child of node.children) out.push(...collectText(child));
  return out;
}

test('PersonaGrid renders exactly 5 cards from the full persona list', () => {
  const doc = createFakeDocument();
  const grid = createPersonaGrid({
    personas,
    onSelect: () => {},
    document: doc,
  });

  // The seed ships 5 personas — PersonaGrid must render one card per persona.
  assert.equal(personas.length, 5, 'data module should ship 5 personas');
  assert.equal(grid.children.length, 5, 'grid should have exactly 5 children');
  assert.equal(grid.cards.length, 5, 'grid.cards should contain 5 entries');

  // Every rendered child must carry the persona-card class (assigned by PersonaCard).
  for (const card of grid.cards) {
    assert.equal(
      card.className,
      'persona-card',
      `expected persona-card class on card; got "${card.className}"`
    );
  }
});

test('PersonaGrid renders each persona name within a card', () => {
  const doc = createFakeDocument();
  const grid = createPersonaGrid({
    personas,
    onSelect: () => {},
    document: doc,
  });

  const expectedNames = personas.map((p) => p.persona_name);
  for (let i = 0; i < grid.cards.length; i++) {
    const texts = collectText(grid.cards[i]);
    assert.ok(
      texts.includes(expectedNames[i]),
      `card ${i} should include "${expectedNames[i]}"; got ${JSON.stringify(texts)}`
    );
  }
});

test('PersonaGrid cards are in the same order as the personas array', () => {
  const doc = createFakeDocument();
  const grid = createPersonaGrid({
    personas,
    onSelect: () => {},
    document: doc,
  });

  for (let i = 0; i < personas.length; i++) {
    assert.equal(
      grid.cards[i].attributes['data-persona-id'],
      personas[i].persona_id,
      `card ${i} should have data-persona-id="${personas[i].persona_id}"`
    );
  }
});

test('PersonaGrid forwards card clicks to onSelect with the correct persona', () => {
  const doc = createFakeDocument();
  const calls = [];
  const grid = createPersonaGrid({
    personas,
    onSelect: (p) => calls.push(p),
    document: doc,
  });

  // Click the third card (index 2).
  grid.cards[2].dispatch('click');

  assert.equal(calls.length, 1, 'onSelect should fire exactly once');
  assert.equal(
    calls[0].persona_id,
    personas[2].persona_id,
    `onSelect should receive persona ${personas[2].persona_id}`
  );
});

test('PersonaGrid validates required arguments', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createPersonaGrid({ onSelect: () => {}, document: doc }),
    /personas/
  );
  assert.throws(
    () => createPersonaGrid({ personas, document: doc }),
    /onSelect/
  );
});

test('PersonaGrid renders correct grid wrapper with persona-grid class', () => {
  const doc = createFakeDocument();
  const grid = createPersonaGrid({
    personas,
    onSelect: () => {},
    document: doc,
  });

  assert.equal(
    grid.className,
    'persona-grid',
    'root element should carry persona-grid class'
  );
});

test('PersonaGrid with a subset of personas renders only that many cards', () => {
  const doc = createFakeDocument();
  const subset = personas.slice(0, 3);
  const grid = createPersonaGrid({
    personas: subset,
    onSelect: () => {},
    document: doc,
  });

  assert.equal(grid.cards.length, 3);
  assert.equal(grid.children.length, 3);

  for (let i = 0; i < subset.length; i++) {
    assert.equal(
      grid.cards[i].attributes['data-persona-id'],
      subset[i].persona_id
    );
  }
});

test('PersonaGrid cards expose correct data-persona-id attributes', () => {
  const doc = createFakeDocument();
  const grid = createPersonaGrid({
    personas,
    onSelect: () => {},
    document: doc,
  });

  const expectedIds = personas.map((p) => p.persona_id);
  for (let i = 0; i < grid.cards.length; i++) {
    assert.equal(
      grid.cards[i].attributes['data-persona-id'],
      expectedIds[i]
    );
  }
});
