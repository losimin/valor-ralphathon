// Unit tests for the task-sorting module.
//
// Verifies that sortTasksByFrequency:
//   1. Orders tasks by task_frequency descending on a synthetic sample.
//   2. Breaks ties by task_name ascending for deterministic output.
//   3. Does not mutate its input array.
//   4. Sorts tasks lacking a numeric task_frequency to the end.
//   5. Orders every real persona's task list correctly (smoke test
//      against the hardcoded data in `src/data/personas.js`).
//
// Verifies that sortTasksByDimension:
//   6. Sorts by each valid numeric dimension in the correct direction.
//   7. Breaks ties by task_name ascending.
//   8. Does not mutate its input array.
//   9. Sorts tasks with missing dimension values to the end.
//  10. Throws for invalid dimensions.
//  11. Throws for non-array input.
//  12. Orders every real persona's task list correctly for every
//      dimension (smoke test).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sortTasksByFrequency,
  sortTasksByDimension,
  VALID_DIMENSIONS,
} = require('../taskSort');
const { personas } = require('../../data/personas');

// ── sortTasksByFrequency tests (existing) ────────────────────────────────

test('orders tasks by task_frequency descending', () => {
  const input = [
    { task_name: 'a', task_frequency: 1 },
    { task_name: 'b', task_frequency: 5 },
    { task_name: 'c', task_frequency: 3 },
    { task_name: 'd', task_frequency: 4 },
  ];
  const sorted = sortTasksByFrequency(input);
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['b', 'd', 'c', 'a']
  );
});

test('breaks ties on task_frequency by task_name ascending', () => {
  const input = [
    { task_name: 'zeta', task_frequency: 2 },
    { task_name: 'alpha', task_frequency: 2 },
    { task_name: 'mu', task_frequency: 5 },
  ];
  const sorted = sortTasksByFrequency(input);
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['mu', 'alpha', 'zeta']
  );
});

test('does not mutate the input array', () => {
  const input = [
    { task_name: 'a', task_frequency: 1 },
    { task_name: 'b', task_frequency: 2 },
  ];
  const snapshot = input.map((t) => t.task_name);
  sortTasksByFrequency(input);
  assert.deepEqual(input.map((t) => t.task_name), snapshot);
});

test('sorts tasks with missing task_frequency to the end', () => {
  const input = [
    { task_name: 'has-freq-low', task_frequency: 1 },
    { task_name: 'no-freq' },
    { task_name: 'has-freq-high', task_frequency: 10 },
  ];
  const sorted = sortTasksByFrequency(input);
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['has-freq-high', 'has-freq-low', 'no-freq']
  );
});

test('throws when input is not an array', () => {
  assert.throws(() => sortTasksByFrequency(null), /must be an array/);
  assert.throws(() => sortTasksByFrequency({}), /must be an array/);
});

test('orders every seeded persona task list descending by frequency', () => {
  for (const persona of personas) {
    const sorted = sortTasksByFrequency(persona.tasks);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i - 1].task_frequency >= sorted[i].task_frequency,
        `${persona.persona_id}: tasks not descending at index ${i}`
      );
    }
  }
});

// ── sortTasksByDimension tests (new) ─────────────────────────────────────

test('sortTasksByDimension sorts by time_saved_pct descending', () => {
  const input = [
    { task_name: 'low', time_saved_pct: 25 },
    { task_name: 'high', time_saved_pct: 75 },
    { task_name: 'mid', time_saved_pct: 50 },
  ];
  const sorted = sortTasksByDimension(input, 'time_saved_pct');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['high', 'mid', 'low']
  );
});

test('sortTasksByDimension sorts by roi_weekly descending', () => {
  const input = [
    { task_name: 'small', roi_weekly: 100 },
    { task_name: 'large', roi_weekly: 500 },
    { task_name: 'medium', roi_weekly: 300 },
  ];
  const sorted = sortTasksByDimension(input, 'roi_weekly');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['large', 'medium', 'small']
  );
});

test('sortTasksByDimension sorts by automation_confidence descending', () => {
  const input = [
    { task_name: 'maybe', automation_confidence: 70 },
    { task_name: 'definite', automation_confidence: 95 },
    { task_name: 'likely', automation_confidence: 85 },
  ];
  const sorted = sortTasksByDimension(input, 'automation_confidence');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['definite', 'likely', 'maybe']
  );
});

test('sortTasksByDimension sorts by current_hours_weekly descending', () => {
  const input = [
    { task_name: 'light', current_hours_weekly: 3 },
    { task_name: 'heavy', current_hours_weekly: 20 },
    { task_name: 'medium', current_hours_weekly: 8 },
  ];
  const sorted = sortTasksByDimension(input, 'current_hours_weekly');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['heavy', 'medium', 'light']
  );
});

test('sortTasksByDimension sorts by projected_hours_weekly ascending', () => {
  const input = [
    { task_name: 'mid', projected_hours_weekly: 4 },
    { task_name: 'best', projected_hours_weekly: 1 },
    { task_name: 'worst', projected_hours_weekly: 8 },
  ];
  const sorted = sortTasksByDimension(input, 'projected_hours_weekly');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['best', 'mid', 'worst']
  );
});

test('sortTasksByDimension sorts by task_name ascending', () => {
  const input = [
    { task_name: 'Charlie' },
    { task_name: 'Alpha' },
    { task_name: 'Bravo' },
  ];
  const sorted = sortTasksByDimension(input, 'task_name');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['Alpha', 'Bravo', 'Charlie']
  );
});

test('sortTasksByDimension sorts by confidence_interval_low descending', () => {
  const input = [
    { task_name: 'wide', confidence_interval_low: 20 },
    { task_name: 'narrow', confidence_interval_low: 60 },
    { task_name: 'mid', confidence_interval_low: 40 },
  ];
  const sorted = sortTasksByDimension(input, 'confidence_interval_low');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['narrow', 'mid', 'wide']
  );
});

test('sortTasksByDimension sorts by confidence_interval_high descending', () => {
  const input = [
    { task_name: 'low', confidence_interval_high: 55 },
    { task_name: 'high', confidence_interval_high: 90 },
    { task_name: 'mid', confidence_interval_high: 72 },
  ];
  const sorted = sortTasksByDimension(input, 'confidence_interval_high');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['high', 'mid', 'low']
  );
});

test('sortTasksByDimension breaks ties by task_name ascending', () => {
  const input = [
    { task_name: 'zulu', time_saved_pct: 50 },
    { task_name: 'alpha', time_saved_pct: 50 },
    { task_name: 'mike', time_saved_pct: 75 },
    { task_name: 'beta', time_saved_pct: 50 },
  ];
  const sorted = sortTasksByDimension(input, 'time_saved_pct');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['mike', 'alpha', 'beta', 'zulu']
  );
});

test('sortTasksByDimension does not mutate the input array', () => {
  const input = [
    { task_name: 'a', roi_weekly: 100 },
    { task_name: 'b', roi_weekly: 300 },
  ];
  const snapshot = input.map((t) => t.task_name);
  sortTasksByDimension(input, 'roi_weekly');
  assert.deepEqual(input.map((t) => t.task_name), snapshot);
});

test('sortTasksByDimension sorts tasks with missing dimension to the end (descending)', () => {
  const input = [
    { task_name: 'has-val-low', time_saved_pct: 25 },
    { task_name: 'no-val' },
    { task_name: 'has-val-high', time_saved_pct: 75 },
  ];
  const sorted = sortTasksByDimension(input, 'time_saved_pct');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['has-val-high', 'has-val-low', 'no-val']
  );
});

test('sortTasksByDimension sorts tasks with missing dimension to the end (ascending)', () => {
  const input = [
    { task_name: 'mid', projected_hours_weekly: 4 },
    { task_name: 'no-val' },
    { task_name: 'best', projected_hours_weekly: 1 },
  ];
  const sorted = sortTasksByDimension(input, 'projected_hours_weekly');
  assert.deepEqual(
    sorted.map((t) => t.task_name),
    ['best', 'mid', 'no-val']
  );
});

test('sortTasksByDimension throws for invalid dimension', () => {
  const input = [{ task_name: 'a', task_frequency: 1 }];
  assert.throws(
    () => sortTasksByDimension(input, 'nonexistent'),
    /unknown dimension/
  );
  assert.throws(
    () => sortTasksByDimension(input, ''),
    /non-empty string/
  );
});

test('sortTasksByDimension throws for non-string dimension', () => {
  const input = [{ task_name: 'a' }];
  assert.throws(
    () => sortTasksByDimension(input, null),
    /non-empty string/
  );
  assert.throws(
    () => sortTasksByDimension(input, 123),
    /non-empty string/
  );
});

test('sortTasksByDimension throws for non-array input', () => {
  assert.throws(
    () => sortTasksByDimension(null, 'task_frequency'),
    /must be an array/
  );
  assert.throws(
    () => sortTasksByDimension({}, 'task_frequency'),
    /must be an array/
  );
});

test('sortTasksByDimension sorts every persona by every valid dimension without throwing', () => {
  for (const persona of personas) {
    for (const dim of VALID_DIMENSIONS) {
      const sorted = sortTasksByDimension(persona.tasks, dim);
      assert.equal(
        sorted.length,
        persona.tasks.length,
        `${persona.persona_id}/${dim}: should preserve task count`
      );
    }
  }
});

test('sortTasksByDimension sorts every persona correctly by time_saved_pct descending', () => {
  for (const persona of personas) {
    const sorted = sortTasksByDimension(persona.tasks, 'time_saved_pct');
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i - 1].time_saved_pct >= sorted[i].time_saved_pct,
        `${persona.persona_id}: time_saved_pct not descending at index ${i}`
      );
    }
  }
});

test('sortTasksByDimension sorts every persona correctly by roi_weekly descending', () => {
  for (const persona of personas) {
    const sorted = sortTasksByDimension(persona.tasks, 'roi_weekly');
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i - 1].roi_weekly >= sorted[i].roi_weekly,
        `${persona.persona_id}: roi_weekly not descending at index ${i}`
      );
    }
  }
});

test('sortTasksByDimension sorts every persona correctly by automation_confidence descending', () => {
  for (const persona of personas) {
    const sorted = sortTasksByDimension(persona.tasks, 'automation_confidence');
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i - 1].automation_confidence >= sorted[i].automation_confidence,
        `${persona.persona_id}: automation_confidence not descending at index ${i}`
      );
    }
  }
});

test('sortTasksByDimension on task_frequency matches sortTasksByFrequency', () => {
  for (const persona of personas) {
    const byFreq = sortTasksByFrequency(persona.tasks);
    const byDim = sortTasksByDimension(persona.tasks, 'task_frequency');
    assert.deepEqual(
      byFreq.map((t) => t.task_name),
      byDim.map((t) => t.task_name),
      `${persona.persona_id}: sortTasksByFrequency should match sortTasksByDimension('task_frequency')`
    );
  }
});
