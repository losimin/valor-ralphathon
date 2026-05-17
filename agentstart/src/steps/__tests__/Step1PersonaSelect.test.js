// Unit tests for Step1PersonaSelect.
// Verifies that the Step 1 container renders one PersonaCard per persona from
// the data module — the sub-AC requires exactly 5 cards.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStep1PersonaSelect } = require('../Step1PersonaSelect');
const { personas } = require('../../data/personas');

// Minimal DOM stub mirroring the one used by PersonaCard tests so the suite
// stays dependency-free.
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

test('Step1PersonaSelect renders exactly 5 PersonaCard components', () => {
  const doc = createFakeDocument();
  const root = createStep1PersonaSelect({
    onSelect: () => {},
    document: doc,
  });

  // The persona data module is the source of truth; assert both that we
  // rendered one card per persona and that the count equals 5 (per seed).
  assert.equal(personas.length, 5, 'data module should ship 5 personas');
  assert.equal(
    root.cards.length,
    5,
    `expected 5 PersonaCards rendered, got ${root.cards.length}`
  );
  assert.equal(
    root.grid.children.length,
    5,
    'persona grid should contain 5 children'
  );

  // Every card should carry the persona-card class assigned by PersonaCard.
  for (const card of root.cards) {
    assert.equal(card.className, 'persona-card');
  }
});

test('Step1PersonaSelect forwards card clicks to onSelect with the persona', () => {
  const doc = createFakeDocument();
  const calls = [];
  const root = createStep1PersonaSelect({
    onSelect: (p) => calls.push(p),
    document: doc,
  });

  root.cards[2].dispatch('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].persona_id, personas[2].persona_id);
});

test('Step1PersonaSelect validates onSelect argument', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createStep1PersonaSelect({ document: doc }),
    /onSelect/
  );
});
