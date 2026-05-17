// Unit tests for the form data store module.
//
// Verifies all four operations (save, retrieve, clear, has) across normal
// usage, edge cases, and error conditions. The store must correctly isolate
// data by personaId and stepIndex, survive sequential saves/clears, and
// enforce input validation.
//
// Coverage:
//   - Basic save → retrieve round-trip
//   - Multi-step save and per-step retrieval
//   - Multi-persona isolation
//   - Overwrite (last-write-wins)
//   - Scoped clear (single persona) vs global clear
//   - Idempotent clear
//   - has() truthiness
//   - Type and range errors for all public methods

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFormDataStore } = require('../formDataStore');

// ─────────────────────────────────────────────────────────────────────────────
// save + retrieve — basic round-trip
// ─────────────────────────────────────────────────────────────────────────────

test('save and retrieve — round-trip for a single persona/step', () => {
  const store = createFormDataStore();

  const data = { toggleEnabled: true, selectedOption: 'a' };
  store.save('editor', 4, data);

  const result = store.retrieve('editor', 4);
  assert.deepEqual(result, data);
});

test('save and retrieve — different data types survive round-trip', () => {
  const store = createFormDataStore();

  // Numbers, booleans, strings, arrays, nested objects
  const data = {
    count: 42,
    active: false,
    name: 'Agent Copyedit',
    tags: ['draft', 'urgent'],
    config: { model: 'claude', temperature: 0.7 },
  };
  store.save('teacher', 3, data);

  assert.deepEqual(store.retrieve('teacher', 3), data);
});

test('retrieve specific step returns undefined when nothing saved', () => {
  const store = createFormDataStore();
  assert.equal(store.retrieve('editor', 4), undefined);
});

test('retrieve all steps returns empty object when nothing saved', () => {
  const store = createFormDataStore();
  assert.deepEqual(store.retrieve('editor'), {});
});

test('retrieve with no stepIndex returns all saved steps for persona', () => {
  const store = createFormDataStore();

  store.save('editor', 1, { personaId: 'editor' });
  store.save('editor', 2, { kpiView: 'expanded' });
  store.save('editor', 4, { toggles: { 'Copyedit Agent': true } });

  const all = store.retrieve('editor');
  assert.deepEqual(all, {
    1: { personaId: 'editor' },
    2: { kpiView: 'expanded' },
    4: { toggles: { 'Copyedit Agent': true } },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-step save and retrieval
// ─────────────────────────────────────────────────────────────────────────────

test('save step 4 data does not appear in step 3 retrieval', () => {
  const store = createFormDataStore();

  store.save('project_manager', 3, { selectedTask: 'status_report' });
  store.save('project_manager', 4, { toggles: { 'Status Report Agent': true } });

  assert.deepEqual(
    store.retrieve('project_manager', 3),
    { selectedTask: 'status_report' }
  );
  assert.deepEqual(
    store.retrieve('project_manager', 4),
    { toggles: { 'Status Report Agent': true } }
  );
});

test('retrieve all steps for persona with only some steps saved', () => {
  const store = createFormDataStore();

  store.save('customer_service_rep', 2, { expanded: true });
  store.save('customer_service_rep', 5, { confirmed: true });

  // Steps 1, 3, 4 should NOT appear
  const all = store.retrieve('customer_service_rep');
  assert.deepEqual(Object.keys(all).sort(), ['2', '5']);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-persona isolation
// ─────────────────────────────────────────────────────────────────────────────

test('data for different personas are isolated', () => {
  const store = createFormDataStore();

  store.save('editor', 4, { toggles: { agent1: true } });
  store.save('teacher', 4, { toggles: { agent1: false, agent2: true } });
  store.save('financial_advisor', 4, { toggles: {} });

  assert.deepEqual(store.retrieve('editor', 4), { toggles: { agent1: true } });
  assert.deepEqual(store.retrieve('teacher', 4), { toggles: { agent1: false, agent2: true } });
  assert.deepEqual(store.retrieve('financial_advisor', 4), { toggles: {} });
});

test('retrieve for non-existent persona returns undefined for specific step', () => {
  const store = createFormDataStore();
  store.save('editor', 1, { x: 1 });

  assert.equal(store.retrieve('teacher', 1), undefined);
});

test('retrieve all for non-existent persona returns empty object', () => {
  const store = createFormDataStore();
  store.save('editor', 1, { x: 1 });

  assert.deepEqual(store.retrieve('teacher'), {});
});

// ─────────────────────────────────────────────────────────────────────────────
// Overwrite (last-write-wins)
// ─────────────────────────────────────────────────────────────────────────────

test('save overwrites previous data for same persona/step', () => {
  const store = createFormDataStore();

  store.save('editor', 4, { toggles: { a: true } });
  store.save('editor', 4, { toggles: { a: false, b: true } });

  assert.deepEqual(store.retrieve('editor', 4), { toggles: { a: false, b: true } });
});

test('repeated save/retrieve cycles are consistent', () => {
  const store = createFormDataStore();

  for (let i = 0; i < 5; i++) {
    store.save('teacher', 3, { iteration: i });
    assert.deepEqual(store.retrieve('teacher', 3), { iteration: i });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// clear — scoped and global
// ─────────────────────────────────────────────────────────────────────────────

test('clear with personaId removes only that persona', () => {
  const store = createFormDataStore();

  store.save('editor', 1, { selected: 'editor' });
  store.save('teacher', 1, { selected: 'teacher' });

  store.clear('editor');

  assert.equal(store.retrieve('editor', 1), undefined);
  assert.deepEqual(store.retrieve('editor'), {});
  assert.deepEqual(store.retrieve('teacher', 1), { selected: 'teacher' });
});

test('clear without personaId removes all data', () => {
  const store = createFormDataStore();

  store.save('editor', 1, { x: 1 });
  store.save('teacher', 1, { x: 2 });
  store.save('project_manager', 2, { x: 3 });

  store.clear();

  assert.equal(store.retrieve('editor', 1), undefined);
  assert.equal(store.retrieve('teacher', 1), undefined);
  assert.equal(store.retrieve('project_manager', 2), undefined);
  assert.deepEqual(store.retrieve('editor'), {});
  assert.deepEqual(store.retrieve('teacher'), {});
  assert.deepEqual(store.retrieve('project_manager'), {});
});

test('clear is idempotent — double clear on same persona does not throw', () => {
  const store = createFormDataStore();

  store.save('editor', 1, { x: 1 });
  store.clear('editor');
  store.clear('editor'); // should not throw

  assert.equal(store.retrieve('editor', 1), undefined);
});

test('clear on never-saved persona does not throw', () => {
  const store = createFormDataStore();
  store.clear('editor'); // should not throw
});

test('global clear on empty store does not throw', () => {
  const store = createFormDataStore();
  store.clear(); // should not throw
});

test('after clear, save still works (clear does not corrupt the store)', () => {
  const store = createFormDataStore();

  store.save('editor', 1, { old: true });
  store.clear('editor');
  store.save('editor', 1, { new: true });

  assert.deepEqual(store.retrieve('editor', 1), { new: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// has — existence check
// ─────────────────────────────────────────────────────────────────────────────

test('has returns true when data exists', () => {
  const store = createFormDataStore();
  store.save('editor', 4, { x: 1 });

  assert.equal(store.has('editor', 4), true);
});

test('has returns false when data does not exist', () => {
  const store = createFormDataStore();

  assert.equal(store.has('editor', 4), false);
});

test('has returns false for non-existent persona', () => {
  const store = createFormDataStore();
  store.save('editor', 1, {});

  assert.equal(store.has('teacher', 1), false);
});

test('has returns false after clear for that persona', () => {
  const store = createFormDataStore();
  store.save('editor', 4, { x: 1 });
  store.clear('editor');

  assert.equal(store.has('editor', 4), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// save — input validation
// ─────────────────────────────────────────────────────────────────────────────

test('save throws on empty personaId', () => {
  const store = createFormDataStore();
  assert.throws(
    () => store.save('', 1, {}),
    /personaId.*non-empty string/
  );
});

test('save throws on non-string personaId', () => {
  const store = createFormDataStore();
  assert.throws(() => store.save(null, 1, {}), /personaId/);
  assert.throws(() => store.save(42, 1, {}), /personaId/);
  assert.throws(() => store.save(undefined, 1, {}), /personaId/);
});

test('save throws on invalid stepIndex (out of range)', () => {
  const store = createFormDataStore();
  assert.throws(() => store.save('editor', 0, {}), /stepIndex.*between 1 and 5/);
  assert.throws(() => store.save('editor', 6, {}), /stepIndex.*between 1 and 5/);
  assert.throws(() => store.save('editor', -1, {}), /stepIndex.*between 1 and 5/);
});

test('save throws on non-integer stepIndex', () => {
  const store = createFormDataStore();
  assert.throws(() => store.save('editor', 1.5, {}), /stepIndex.*integer/);
  assert.throws(() => store.save('editor', NaN, {}), /stepIndex.*integer/);
  assert.throws(() => store.save('editor', '1', {}), /stepIndex.*integer/);
});

// ─────────────────────────────────────────────────────────────────────────────
// retrieve — input validation
// ─────────────────────────────────────────────────────────────────────────────

test('retrieve throws on empty personaId', () => {
  const store = createFormDataStore();
  assert.throws(
    () => store.retrieve('', 1),
    /personaId.*non-empty string/
  );
});

test('retrieve throws on non-string personaId', () => {
  const store = createFormDataStore();
  assert.throws(() => store.retrieve(null, 1), /personaId/);
  assert.throws(() => store.retrieve(undefined, 1), /personaId/);
});

test('retrieve with stepIndex throws on out-of-range step', () => {
  const store = createFormDataStore();
  assert.throws(() => store.retrieve('editor', 0), /stepIndex.*between 1 and 5/);
  assert.throws(() => store.retrieve('editor', 6), /stepIndex.*between 1 and 5/);
});

// ─────────────────────────────────────────────────────────────────────────────
// clear — input validation
// ─────────────────────────────────────────────────────────────────────────────

test('clear throws on empty personaId string', () => {
  const store = createFormDataStore();
  assert.throws(
    () => store.clear(''),
    /personaId.*non-empty string/
  );
});

test('clear throws on non-string personaId', () => {
  const store = createFormDataStore();
  assert.throws(() => store.clear(null), /personaId/);
  assert.throws(() => store.clear(42), /personaId/);
});

// ─────────────────────────────────────────────────────────────────────────────
// has — input validation
// ─────────────────────────────────────────────────────────────────────────────

test('has throws on empty personaId', () => {
  const store = createFormDataStore();
  assert.throws(
    () => store.has('', 1),
    /personaId.*non-empty string/
  );
});

test('has throws on non-string personaId', () => {
  const store = createFormDataStore();
  assert.throws(() => store.has(null, 1), /personaId/);
});

test('has throws on invalid stepIndex', () => {
  const store = createFormDataStore();
  assert.throws(() => store.has('editor', 0), /stepIndex.*between 1 and 5/);
  assert.throws(() => store.has('editor', 6), /stepIndex.*between 1 and 5/);
  assert.throws(() => store.has('editor', 1.5), /stepIndex.*integer/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration — full wizard simulation
// ─────────────────────────────────────────────────────────────────────────────

test('full wizard flow: save across all steps, retrieve mid-wizard', () => {
  const store = createFormDataStore();

  // Step 1 — persona selection
  store.save('editor', 1, { selectedPersonaId: 'editor' });

  // Step 2 — KPI view preference
  store.save('editor', 2, { expandedTask: 'copyedit', sortOrder: 'frequency' });

  // Step 3 — workflow interaction (task clicks)
  store.save('editor', 3, { viewedTasks: ['copyedit', 'proofread'] });

  // Step 4 — agent toggles
  store.save('editor', 4, {
    toggles: {
      'Copyedit Agent': true,
      'Proofread Agent': false,
      'Fact-check Agent': true,
      'Formatting Agent': false,
    },
  });

  // Step 5 — completion confirmation
  store.save('editor', 5, { confirmed: true, enabledAgents: 2 });

  // Now verify retrieving at any point
  assert.equal(store.has('editor', 1), true);
  assert.equal(store.has('editor', 2), true);
  assert.equal(store.has('editor', 3), true);
  assert.equal(store.has('editor', 4), true);
  assert.equal(store.has('editor', 5), true);

  const step4Data = store.retrieve('editor', 4);
  assert.equal(step4Data.toggles['Copyedit Agent'], true);
  assert.equal(step4Data.toggles['Proofread Agent'], false);

  const allData = store.retrieve('editor');
  assert.equal(Object.keys(allData).length, 5);
});

test('wizard restart: clear persona, re-save from scratch', () => {
  const store = createFormDataStore();

  // First run
  store.save('editor', 1, { selectedPersonaId: 'editor' });
  store.save('editor', 4, { toggles: { 'Copyedit Agent': true } });

  // Restart — clear this persona
  store.clear('editor');

  // Second run with different toggles
  store.save('editor', 1, { selectedPersonaId: 'editor' });
  store.save('editor', 4, { toggles: { 'Copyedit Agent': false } });

  assert.deepEqual(store.retrieve('editor', 4), { toggles: { 'Copyedit Agent': false } });
  assert.equal(store.has('editor', 2), false);
});

test('persona switch: save for different personas, clear old, new unaffected', () => {
  const store = createFormDataStore();

  // User starts with editor
  store.save('editor', 1, { selected: 'editor' });
  store.save('editor', 4, { toggles: { a: true } });

  // User switches to teacher — clear editor, save teacher
  store.clear('editor');
  store.save('teacher', 1, { selected: 'teacher' });
  store.save('teacher', 4, { toggles: { b: true } });

  // Editor data is gone
  assert.equal(store.retrieve('editor', 1), undefined);
  assert.deepEqual(store.retrieve('editor'), {});

  // Teacher data is intact
  assert.deepEqual(store.retrieve('teacher', 1), { selected: 'teacher' });
  assert.deepEqual(store.retrieve('teacher', 4), { toggles: { b: true } });
});

test('store instances are independent (no shared state)', () => {
  const store1 = createFormDataStore();
  const store2 = createFormDataStore();

  store1.save('editor', 1, { from: 'store1' });
  store2.save('editor', 1, { from: 'store2' });

  assert.deepEqual(store1.retrieve('editor', 1), { from: 'store1' });
  assert.deepEqual(store2.retrieve('editor', 1), { from: 'store2' });
});

test('save with undefined data is valid (clears step data to undefined value)', () => {
  const store = createFormDataStore();

  store.save('editor', 4, { toggles: { a: true } });
  store.save('editor', 4, undefined);

  assert.equal(store.retrieve('editor', 4), undefined);
  assert.equal(store.has('editor', 4), true); // key still exists, value is undefined
});

test('save with null data is preserved as null', () => {
  const store = createFormDataStore();

  store.save('editor', 4, null);

  assert.equal(store.retrieve('editor', 4), null);
  assert.equal(store.has('editor', 4), true);
});
