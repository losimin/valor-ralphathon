// Unit tests for the time-savings percentage computation module.
//
// Verifies that `computeTimeSavingsPct` correctly calculates the percentage
// reduction in time spent for all five seeded personas' tasks, and that the
// `computeTaskTimeSavingsPct` convenience wrapper reads task objects
// correctly.
//
// Expected percentages are hand-computed from the hardcoded hours in
// `src/data/personas.js`:
//   time_saved_pct = ((current - projected) / current) × 100
//
// The raw (unrounded) value is verified here. Callers that need rounded
// whole-percent display values apply Math.round themselves.

const test = require('node:test');
const assert = require('node:assert/strict');

const { personas } = require('../../data/personas');
const {
  computeTimeSavingsPct,
  computeTaskTimeSavingsPct,
  calculateTimeSaved,
} = require('../timeSavings');

// ---------------------------------------------------------------------------
// computeTimeSavingsPct — core function validation
// ---------------------------------------------------------------------------

test('computeTimeSavingsPct — editor copyedit: 12h → 3h = 75%', () => {
  // (12 − 3) / 12 × 100 = 75
  const result = computeTimeSavingsPct(12, 3);
  assert.equal(result, 75);
});

test('computeTimeSavingsPct — editor fact-check: 8h → 3h = 62.5%', () => {
  // (8 − 3) / 8 × 100 = 62.5
  const result = computeTimeSavingsPct(8, 3);
  assert.equal(result, 62.5);
});

test('computeTimeSavingsPct — editor headlines SEO: 4h → 1h = 75%', () => {
  // (4 − 1) / 4 × 100 = 75
  const result = computeTimeSavingsPct(4, 1);
  assert.equal(result, 75);
});

test('computeTimeSavingsPct — editor revision coord: 6h → 4h ≈ 33.33%', () => {
  // (6 − 4) / 6 × 100 = 33.333…
  const result = computeTimeSavingsPct(6, 4);
  assert.ok(Math.abs(result - 33.333333333333336) < 1e-10);
});

test('computeTimeSavingsPct — financial advisor portfolio: 10h → 3h = 70%', () => {
  const result = computeTimeSavingsPct(10, 3);
  assert.equal(result, 70);
});

test('computeTimeSavingsPct — financial advisor client inbox: 8h → 3h = 62.5%', () => {
  const result = computeTimeSavingsPct(8, 3);
  assert.equal(result, 62.5);
});

test('computeTimeSavingsPct — financial advisor retirement: 6h → 2h ≈ 66.67%', () => {
  const result = computeTimeSavingsPct(6, 2);
  assert.ok(Math.abs(result - 66.66666666666667) < 1e-10);
});

test('computeTimeSavingsPct — financial advisor compliance: 4h → 2h = 50%', () => {
  const result = computeTimeSavingsPct(4, 2);
  assert.equal(result, 50);
});

test('computeTimeSavingsPct — teacher grading: 10h → 4h = 60%', () => {
  const result = computeTimeSavingsPct(10, 4);
  assert.equal(result, 60);
});

test('computeTimeSavingsPct — teacher lesson plans: 6h → 2h ≈ 66.67%', () => {
  const result = computeTimeSavingsPct(6, 2);
  assert.ok(Math.abs(result - 66.66666666666667) < 1e-10);
});

test('computeTimeSavingsPct — teacher parent comms: 3h → 1h ≈ 66.67%', () => {
  const result = computeTimeSavingsPct(3, 1);
  assert.ok(Math.abs(result - 66.66666666666667) < 1e-10);
});

test('computeTimeSavingsPct — teacher IEP: 4h → 2h = 50%', () => {
  const result = computeTimeSavingsPct(4, 2);
  assert.equal(result, 50);
});

test('computeTimeSavingsPct — PM status reports: 6h → 1h ≈ 83.33%', () => {
  const result = computeTimeSavingsPct(6, 1);
  assert.ok(Math.abs(result - 83.33333333333333) < 1e-10);
});

test('computeTimeSavingsPct — PM standups: 5h → 2h = 60%', () => {
  const result = computeTimeSavingsPct(5, 2);
  assert.equal(result, 60);
});

test('computeTimeSavingsPct — PM schedules: 5h → 2h = 60%', () => {
  const result = computeTimeSavingsPct(5, 2);
  assert.equal(result, 60);
});

test('computeTimeSavingsPct — PM stakeholder comms: 4h → 1h = 75%', () => {
  const result = computeTimeSavingsPct(4, 1);
  assert.equal(result, 75);
});

test('computeTimeSavingsPct — PM risk log: 3h → 1h ≈ 66.67%', () => {
  const result = computeTimeSavingsPct(3, 1);
  assert.ok(Math.abs(result - 66.66666666666667) < 1e-10);
});

test('computeTimeSavingsPct — CSR tickets: 20h → 6h = 70%', () => {
  const result = computeTimeSavingsPct(20, 6);
  assert.equal(result, 70);
});

test('computeTimeSavingsPct — CSR triage: 6h → 1h ≈ 83.33%', () => {
  const result = computeTimeSavingsPct(6, 1);
  assert.ok(Math.abs(result - 83.33333333333333) < 1e-10);
});

test('computeTimeSavingsPct — CSR live chat: 12h → 6h = 50%', () => {
  const result = computeTimeSavingsPct(12, 6);
  assert.equal(result, 50);
});

test('computeTimeSavingsPct — CSR returns: 5h → 2h = 60%', () => {
  const result = computeTimeSavingsPct(5, 2);
  assert.equal(result, 60);
});

test('computeTimeSavingsPct — CSR call summaries: 3h → 1h ≈ 66.67%', () => {
  const result = computeTimeSavingsPct(3, 1);
  assert.ok(Math.abs(result - 66.66666666666667) < 1e-10);
});

// ---------------------------------------------------------------------------
// Edge cases — zero values
// ---------------------------------------------------------------------------

test('computeTimeSavingsPct — zero original, zero assisted returns 0%', () => {
  const result = computeTimeSavingsPct(0, 0);
  assert.equal(result, 0);
});

test('computeTimeSavingsPct — no time saved (projected equals original) returns 0%', () => {
  const result = computeTimeSavingsPct(8, 8);
  assert.equal(result, 0);
});

test('computeTimeSavingsPct — throws when original is 0 and assisted > 0', () => {
  assert.throws(
    () => computeTimeSavingsPct(0, 5),
    /originalHours.*is 0/
  );
});

// ---------------------------------------------------------------------------
// Edge cases — typical fractional values
// ---------------------------------------------------------------------------

test('computeTimeSavingsPct — fractional hours', () => {
  // (3.5 − 1.25) / 3.5 × 100 = (2.25 / 3.5) × 100 = 64.2857…
  const result = computeTimeSavingsPct(3.5, 1.25);
  assert.ok(Math.abs(result - 64.28571428571429) < 1e-10);
});

test('computeTimeSavingsPct — 100% savings (agent does all the work)', () => {
  // (10 − 0) / 10 × 100 = 100
  const result = computeTimeSavingsPct(10, 0);
  assert.equal(result, 100);
});

test('computeTimeSavingsPct — very small hours', () => {
  // (1 − 0.25) / 1 × 100 = 75
  const result = computeTimeSavingsPct(1, 0.25);
  assert.equal(result, 75);
});

// ---------------------------------------------------------------------------
// Validation — originalHours
// ---------------------------------------------------------------------------

test('computeTimeSavingsPct — throws on negative originalHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(-1, 0),
    /originalHours.*≥ 0/
  );
});

test('computeTimeSavingsPct — throws on NaN originalHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(NaN, 5),
    /originalHours.*finite/
  );
});

test('computeTimeSavingsPct — throws on Infinity originalHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(Infinity, 5),
    /originalHours.*finite/
  );
});

test('computeTimeSavingsPct — throws on non-number originalHours', () => {
  assert.throws(
    () => computeTimeSavingsPct('12', 3),
    /originalHours.*finite/
  );
  assert.throws(
    () => computeTimeSavingsPct(null, 3),
    /originalHours.*finite/
  );
  assert.throws(
    () => computeTimeSavingsPct(undefined, 3),
    /originalHours.*finite/
  );
});

// ---------------------------------------------------------------------------
// Validation — aiAssistedHours
// ---------------------------------------------------------------------------

test('computeTimeSavingsPct — throws on negative aiAssistedHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(10, -1),
    /aiAssistedHours.*≥ 0/
  );
});

test('computeTimeSavingsPct — throws on NaN aiAssistedHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(10, NaN),
    /aiAssistedHours.*finite/
  );
});

test('computeTimeSavingsPct — throws on Infinity aiAssistedHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(10, Infinity),
    /aiAssistedHours.*finite/
  );
});

test('computeTimeSavingsPct — throws on non-number aiAssistedHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(10, '5'),
    /aiAssistedHours.*finite/
  );
  assert.throws(
    () => computeTimeSavingsPct(10, null),
    /aiAssistedHours.*finite/
  );
});

// ---------------------------------------------------------------------------
// Validation — business rule: assisted cannot exceed original
// ---------------------------------------------------------------------------

test('computeTimeSavingsPct — throws when aiAssistedHours exceeds originalHours', () => {
  assert.throws(
    () => computeTimeSavingsPct(5, 10),
    /cannot exceed.*originalHours/
  );
});

test('computeTimeSavingsPct — throws when aiAssistedHours barely exceeds', () => {
  assert.throws(
    () => computeTimeSavingsPct(5, 5.01),
    /cannot exceed.*originalHours/
  );
});

// ---------------------------------------------------------------------------
// computeTaskTimeSavingsPct — convenience wrapper
// ---------------------------------------------------------------------------

test('computeTaskTimeSavingsPct — reads task object fields correctly', () => {
  const task = { current_hours_weekly: 12, projected_hours_weekly: 3 };
  const result = computeTaskTimeSavingsPct(task);
  assert.equal(result, 75);
});

test('computeTaskTimeSavingsPct — throws on non-object task', () => {
  assert.throws(
    () => computeTaskTimeSavingsPct(null),
    /task.*must be an object/
  );
  assert.throws(
    () => computeTaskTimeSavingsPct('not-a-task'),
    /task.*must be an object/
  );
  assert.throws(
    () => computeTaskTimeSavingsPct(42),
    /task.*must be an object/
  );
});

test('computeTaskTimeSavingsPct — treats missing hours fields as 0', () => {
  const result = computeTaskTimeSavingsPct({});
  assert.equal(result, 0);
});

test('computeTaskTimeSavingsPct — throws when current_hours is missing and projected > 0', () => {
  // When current_hours_weekly is missing it defaults to 0, but
  // projected_hours_weekly > 0 is impossible — you cannot have AI-assisted
  // hours when there is no original work to save time on.
  assert.throws(
    () =>
      computeTaskTimeSavingsPct({
        projected_hours_weekly: 5,
      }),
    /originalHours.*is 0/
  );
});

test('computeTaskTimeSavingsPct — treats missing projected_hours as 0', () => {
  // (10 − 0) / 10 × 100 = 100
  const result = computeTaskTimeSavingsPct({
    current_hours_weekly: 10,
  });
  assert.equal(result, 100);
});

test('computeTaskTimeSavingsPct — throws when projected exceeds current', () => {
  assert.throws(
    () =>
      computeTaskTimeSavingsPct({
        current_hours_weekly: 5,
        projected_hours_weekly: 10,
      }),
    /cannot exceed.*originalHours/
  );
});

// ---------------------------------------------------------------------------
// Cross-persona consistency — verify against all hardcoded tasks
// ---------------------------------------------------------------------------

test('computeTimeSavingsPct matches hardcoded time_saved_pct for every task', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      const rawPct = computeTimeSavingsPct(
        task.current_hours_weekly,
        task.projected_hours_weekly
      );
      const rounded = Math.round(rawPct);
      assert.equal(
        rounded,
        task.time_saved_pct,
        `${persona.persona_id} / ${task.task_name}: ` +
        `raw=${rawPct}, rounded=${rounded}, expected=${task.time_saved_pct}`
      );
    }
  }
});

test('computeTimeSavingsPct is idempotent', () => {
  for (let i = 0; i < 10; i++) {
    const a = computeTimeSavingsPct(12, 3);
    const b = computeTimeSavingsPct(12, 3);
    assert.equal(a, b);
  }
});

test('computeTaskTimeSavingsPct matches direct call for every task', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      const fromTask = computeTaskTimeSavingsPct(task);
      const fromRaw = computeTimeSavingsPct(
        task.current_hours_weekly,
        task.projected_hours_weekly
      );
      assert.equal(
        fromTask,
        fromRaw,
        `${persona.persona_id} / ${task.task_name}: ` +
        `task=${fromTask}, raw=${fromRaw}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// calculateTimeSaved — aggregate persona-level percentage
// ---------------------------------------------------------------------------

/**
 * Helper: look up a persona by id in the hardcoded seed data. Keeps the
 * assertion lines below readable.
 */
function personaById(id) {
  const p = personas.find((x) => x.persona_id === id);
  if (!p) throw new Error(`test setup: persona ${id} not found in seed data`);
  return p;
}

test('calculateTimeSaved — editor aggregates to ~63.33% (30h → 11h)', () => {
  // (30 − 11) / 30 × 100 = 63.333…
  const tasks = personaById('editor').tasks;
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 63.33333333333333) < 1e-10);
});

test('calculateTimeSaved — financial advisor aggregates to ~64.29% (28h → 10h)', () => {
  // (28 − 10) / 28 × 100 = 64.2857…
  const tasks = personaById('financial_advisor').tasks;
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 64.28571428571429) < 1e-10);
});

test('calculateTimeSaved — teacher aggregates to ~60.87% (23h → 9h)', () => {
  // (23 − 9) / 23 × 100 = 60.8695…
  const tasks = personaById('teacher').tasks;
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 60.86956521739131) < 1e-10);
});

test('calculateTimeSaved — project manager aggregates to ~69.57% (23h → 7h)', () => {
  // (23 − 7) / 23 × 100 = 69.5652…
  const tasks = personaById('project_manager').tasks;
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 69.56521739130434) < 1e-10);
});

test('calculateTimeSaved — customer service rep aggregates to ~65.22% (46h → 16h)', () => {
  // (46 − 16) / 46 × 100 = 65.2173…
  const tasks = personaById('customer_service_rep').tasks;
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 65.21739130434783) < 1e-10);
});

test('calculateTimeSaved — rounded values match persona-level KPI math', () => {
  // The Step 2 dashboard displays Math.round(calculateTimeSaved(tasks)).
  // Verify the rounded aggregate for every persona is what we expect.
  const expectedRounded = {
    editor: 63,
    financial_advisor: 64,
    teacher: 61,
    project_manager: 70,
    customer_service_rep: 65,
  };
  for (const persona of personas) {
    const rounded = Math.round(calculateTimeSaved(persona.tasks));
    assert.equal(
      rounded,
      expectedRounded[persona.persona_id],
      `${persona.persona_id}: rounded=${rounded}, ` +
      `expected=${expectedRounded[persona.persona_id]}`
    );
  }
});

test('calculateTimeSaved — empty array returns 0', () => {
  assert.equal(calculateTimeSaved([]), 0);
});

test('calculateTimeSaved — single task matches single-task formula', () => {
  const task = { current_hours_weekly: 12, projected_hours_weekly: 3 };
  const result = calculateTimeSaved([task]);
  assert.equal(result, 75);
});

test('calculateTimeSaved — multiple tasks aggregate correctly (hand-computed)', () => {
  // (10 + 4) − (5 + 1) = 8 saved out of 14 → 57.142857…%
  const tasks = [
    { current_hours_weekly: 10, projected_hours_weekly: 5 },
    { current_hours_weekly: 4, projected_hours_weekly: 1 },
  ];
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 57.142857142857146) < 1e-10);
});

test('calculateTimeSaved — uses aggregate weighting, not per-task average', () => {
  // Per-task average of 50% and 90% = 70%.
  // Aggregate: (10 + 1) − (5 + 0.1) = 5.9 of 11 → ~53.64%.
  // Confirms the function weights by hours, not by simple mean.
  const tasks = [
    { current_hours_weekly: 10, projected_hours_weekly: 5 }, // 50% saved
    { current_hours_weekly: 1, projected_hours_weekly: 0.1 }, // 90% saved
  ];
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 53.63636363636363) < 1e-10);
  assert.notEqual(Math.round(result), 70); // sanity: not the simple mean
});

test('calculateTimeSaved — task with zero hours contributes nothing', () => {
  // Only the non-zero task drives the percentage.
  const tasks = [
    { current_hours_weekly: 10, projected_hours_weekly: 2 }, // 80% saved
    { current_hours_weekly: 0, projected_hours_weekly: 0 },
  ];
  const result = calculateTimeSaved(tasks);
  assert.equal(result, 80);
});

test('calculateTimeSaved — all-zero tasks return 0%', () => {
  const tasks = [
    { current_hours_weekly: 0, projected_hours_weekly: 0 },
    { current_hours_weekly: 0, projected_hours_weekly: 0 },
  ];
  assert.equal(calculateTimeSaved(tasks), 0);
});

test('calculateTimeSaved — missing hours fields default to 0', () => {
  const tasks = [
    { current_hours_weekly: 10, projected_hours_weekly: 4 },
    {}, // both default to 0
  ];
  // Aggregate: (10 + 0) − (4 + 0) = 6 of 10 → 60%
  const result = calculateTimeSaved(tasks);
  assert.equal(result, 60);
});

// Validation

test('calculateTimeSaved — throws when tasks is not an array', () => {
  assert.throws(() => calculateTimeSaved(null), /tasks.*must be an array/);
  assert.throws(() => calculateTimeSaved(undefined), /tasks.*must be an array/);
  assert.throws(() => calculateTimeSaved({}), /tasks.*must be an array/);
  assert.throws(() => calculateTimeSaved('tasks'), /tasks.*must be an array/);
});

test('calculateTimeSaved — throws on non-object task entry', () => {
  assert.throws(
    () => calculateTimeSaved([null]),
    /tasks\[0\].*must be an object/
  );
  assert.throws(
    () => calculateTimeSaved([{ current_hours_weekly: 1, projected_hours_weekly: 0 }, 'bad']),
    /tasks\[1\].*must be an object/
  );
});

test('calculateTimeSaved — throws on non-finite hours', () => {
  assert.throws(
    () => calculateTimeSaved([{ current_hours_weekly: NaN, projected_hours_weekly: 0 }]),
    /current_hours_weekly.*finite/
  );
  assert.throws(
    () => calculateTimeSaved([{ current_hours_weekly: 5, projected_hours_weekly: Infinity }]),
    /projected_hours_weekly.*finite/
  );
});

test('calculateTimeSaved — throws on negative hours', () => {
  assert.throws(
    () => calculateTimeSaved([{ current_hours_weekly: -1, projected_hours_weekly: 0 }]),
    /current_hours_weekly.*≥ 0/
  );
  assert.throws(
    () => calculateTimeSaved([{ current_hours_weekly: 5, projected_hours_weekly: -2 }]),
    /projected_hours_weekly.*≥ 0/
  );
});

test('calculateTimeSaved — throws when aggregate projected exceeds aggregate current', () => {
  // 5 + 3 = 8 current; 10 + 0 = 10 projected → impossible.
  assert.throws(
    () =>
      calculateTimeSaved([
        { current_hours_weekly: 5, projected_hours_weekly: 10 },
        { current_hours_weekly: 3, projected_hours_weekly: 0 },
      ]),
    /cannot exceed.*current_hours_weekly/
  );
});

test('calculateTimeSaved — allows per-task projected > current as long as aggregate balances', () => {
  // Aggregate: 10 + 5 = 15 current; 2 + 6 = 8 projected → 46.67%
  // Even though task[1] has projected (6) > current (5), the persona-level
  // function is total-driven and should accept it.
  const tasks = [
    { current_hours_weekly: 10, projected_hours_weekly: 2 },
    { current_hours_weekly: 5, projected_hours_weekly: 6 },
  ];
  const result = calculateTimeSaved(tasks);
  assert.ok(Math.abs(result - 46.666666666666664) < 1e-10);
});
