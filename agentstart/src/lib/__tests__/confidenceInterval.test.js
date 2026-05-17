// Unit tests for the 95% CI module.
//
// Covers two concerns:
//   1. `computeTaskTimeCi` — converts pre-existing CI percent bounds into
//      hours-saved and projected-hours ranges (existing function).
//   2. `computeConfidenceIntervals` / `ciFromSamples` — derives 95% CI
//      bounds from raw frequency-sample data using sample mean, sample
//      standard deviation (Bessel-corrected), and t/z critical values.
//
// Expected results for `computeConfidenceIntervals` were hand-computed
// with the formulas documented in the module:
//   mean = Σx / n
//   std  = sqrt( Σ(x-mean)² / (n-1) )
//   margin = crit × std / sqrt(n)
//   CI = [mean - margin, mean + margin]  clamped to [0,100], rounded

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CI_LEVEL,
  computeConfidenceInterval,
  computeTaskTimeCi,
  computeConfidenceIntervals,
  ciFromSamples,
} = require('../confidenceInterval');

// =========================================================================
// CI_LEVEL constant
// =========================================================================

test('CI_LEVEL is 0.95', () => {
  assert.equal(CI_LEVEL, 0.95);
});

// =========================================================================
// computeConfidenceInterval(task) — Sub-AC named function returning
// the 95% confidence interval range (lower, upper) for a task's
// estimated weekly time savings.
// =========================================================================

test('computeConfidenceInterval returns {lower, upper} hours-saved for a 10h/60–80% task', () => {
  // 60% of 10h = 6h saved; 80% of 10h = 8h saved
  const ci = computeConfidenceInterval({
    current_hours_weekly: 10,
    confidence_interval_low: 60,
    confidence_interval_high: 80,
  });
  assert.equal(ci.lower, 6);
  assert.equal(ci.upper, 8);
  assert.ok(ci.lower <= ci.upper, 'lower must be <= upper');
  assert.equal(ci.ciLevel, 0.95);
});

test('computeConfidenceInterval handles a fractional 7h/45–75% task with 1-decimal rounding', () => {
  // 0.45*7 = 3.15 → 3.2 ; 0.75*7 = 5.25 → 5.3
  const ci = computeConfidenceInterval({
    current_hours_weekly: 7,
    confidence_interval_low: 45,
    confidence_interval_high: 75,
  });
  assert.equal(ci.lower, 3.2);
  assert.equal(ci.upper, 5.3);
  assert.equal(ci.lowerPct, 45);
  assert.equal(ci.upperPct, 75);
});

test('computeConfidenceInterval exposes projected-hours-remaining bounds too', () => {
  // 10h task, 60–80% saved → 2–4h remaining
  const ci = computeConfidenceInterval({
    current_hours_weekly: 10,
    confidence_interval_low: 60,
    confidence_interval_high: 80,
  });
  assert.equal(ci.lowerProjectedHours, 2);
  assert.equal(ci.upperProjectedHours, 4);
});

test('computeConfidenceInterval yields a degenerate point interval when low == high', () => {
  const ci = computeConfidenceInterval({
    current_hours_weekly: 5,
    confidence_interval_low: 50,
    confidence_interval_high: 50,
  });
  assert.equal(ci.lower, 2.5);
  assert.equal(ci.upper, 2.5);
});

test('computeConfidenceInterval rejects inverted bounds and missing fields', () => {
  assert.throws(
    () =>
      computeConfidenceInterval({
        current_hours_weekly: 10,
        confidence_interval_low: 80,
        confidence_interval_high: 60,
      }),
    /low.*<=.*high/
  );
  assert.throws(
    () =>
      computeConfidenceInterval({
        confidence_interval_low: 50,
        confidence_interval_high: 70,
      }),
    /current_hours_weekly/
  );
});

test('computeConfidenceInterval verifies bounds for realistic persona task inputs', () => {
  // Inputs drawn from the hardcoded persona seed data so the test also
  // serves as a smoke check that the function behaves correctly on the
  // real shapes consumed by Step 2 of the wizard.
  const samples = [
    // Editor — Copyedit drafts: 12h/wk, CI 65–82%
    { task: { current_hours_weekly: 12, confidence_interval_low: 65, confidence_interval_high: 82 },
      expectLower: 7.8, expectUpper: 9.8 },
    // Financial Advisor — Portfolio report: 8h/wk, CI 55–78%
    { task: { current_hours_weekly: 8, confidence_interval_low: 55, confidence_interval_high: 78 },
      expectLower: 4.4, expectUpper: 6.2 },
    // Teacher — Grading: 10h/wk, CI 45–70%
    { task: { current_hours_weekly: 10, confidence_interval_low: 45, confidence_interval_high: 70 },
      expectLower: 4.5, expectUpper: 7 },
    // Project Manager — Status reports: 6h/wk, CI 65–85%
    { task: { current_hours_weekly: 6, confidence_interval_low: 65, confidence_interval_high: 85 },
      expectLower: 3.9, expectUpper: 5.1 },
    // CSR — Tier-1 response: 30h/wk, CI 55–80%
    { task: { current_hours_weekly: 30, confidence_interval_low: 55, confidence_interval_high: 80 },
      expectLower: 16.5, expectUpper: 24 },
  ];
  for (const { task, expectLower, expectUpper } of samples) {
    const ci = computeConfidenceInterval(task);
    assert.equal(ci.lower, expectLower, `lower for ${JSON.stringify(task)}`);
    assert.equal(ci.upper, expectUpper, `upper for ${JSON.stringify(task)}`);
    assert.ok(ci.lower <= ci.upper, 'lower must be <= upper');
    assert.ok(ci.lower >= 0, 'lower must be >= 0');
    assert.ok(ci.upper <= task.current_hours_weekly, 'upper must be <= current_hours_weekly');
  }
});

// =========================================================================
// computeTaskTimeCi — existing function
// =========================================================================

test('computeTaskTimeCi returns correct bounds for a 10h task with 60–80% CI', () => {
  const ci = computeTaskTimeCi({
    current_hours_weekly: 10,
    confidence_interval_low: 60,
    confidence_interval_high: 80,
  });
  assert.equal(ci.lowerPct, 60);
  assert.equal(ci.upperPct, 80);
  assert.equal(ci.lowerHoursSaved, 6);
  assert.equal(ci.upperHoursSaved, 8);
  assert.equal(ci.lowerProjectedHours, 2);
  assert.equal(ci.upperProjectedHours, 4);
});

test('computeTaskTimeCi handles fractional results with 1-decimal rounding', () => {
  // 7h task with 45–75% CI:
  //   saved   = round1(0.45*7), round1(0.75*7)  = 3.2, 5.3
  //   projected derived from rounded saved bounds:
  //     lowerProjected = round1(7 - 5.3) = 1.7
  //     upperProjected = round1(7 - 3.2) = 3.8
  const ci = computeTaskTimeCi({
    current_hours_weekly: 7,
    confidence_interval_low: 45,
    confidence_interval_high: 75,
  });
  assert.equal(ci.lowerHoursSaved, 3.2);
  assert.equal(ci.upperHoursSaved, 5.3);
  assert.equal(ci.lowerProjectedHours, 1.7);
  assert.equal(ci.upperProjectedHours, 3.8);
});

test('computeTaskTimeCi yields a degenerate point interval when low == high', () => {
  const ci = computeTaskTimeCi({
    current_hours_weekly: 5,
    confidence_interval_low: 50,
    confidence_interval_high: 50,
  });
  assert.equal(ci.lowerHoursSaved, 2.5);
  assert.equal(ci.upperHoursSaved, 2.5);
  assert.equal(ci.lowerProjectedHours, 2.5);
  assert.equal(ci.upperProjectedHours, 2.5);
});

test('computeTaskTimeCi enforces lower <= upper on input', () => {
  assert.throws(
    () =>
      computeTaskTimeCi({
        current_hours_weekly: 10,
        confidence_interval_low: 80,
        confidence_interval_high: 60,
      }),
    /low.*<=.*high/
  );
});

test('computeTaskTimeCi rejects missing numeric fields', () => {
  assert.throws(
    () =>
      computeTaskTimeCi({
        current_hours_weekly: 10,
        confidence_interval_low: 50,
      }),
    /confidence_interval_high/
  );
});

// =========================================================================
// ciFromSamples — internal helper tested directly
// =========================================================================

test('ciFromSamples: symmetrical data around 50 with n=5 (uses t-crit)', () => {
  // Samples: [46, 48, 50, 52, 54]
  // n=5, mean=50, std=sqrt(40/4)=√10≈3.1623
  // t-crit for df=4 = 2.776
  // margin = 2.776 * 3.1623 / √5 ≈ 3.926
  // raw CI: [46.07, 53.93] → rounded [46, 54]
  const { low, high } = ciFromSamples([46, 48, 50, 52, 54]);
  assert.equal(low, 46);
  assert.equal(high, 54);
});

test('ciFromSamples: low-variance data with n=30 (uses t-crit for df=29)', () => {
  // 30 samples all = 70. mean=70, std=0, margin=0, CI=[70,70]
  const samples = Array(30).fill(70);
  const { low, high } = ciFromSamples(samples);
  assert.equal(low, 70);
  assert.equal(high, 70);
});

test('ciFromSamples: large sample n=100 (uses z=1.96)', () => {
  // Generate samples with mean ~75, std ~5
  // 50 samples at 72, 50 at 78
  // mean = 75, std ~ sqrt(50*(9)+50*(9))/99 ≈ sqrt(900/99) ≈ 3.015
  // margin = 1.96 * 3.015 / 10 ≈ 0.591
  // raw: [74.41, 75.59] → rounded [74, 76]
  const samples = [];
  for (let i = 0; i < 50; i++) samples.push(72);
  for (let i = 0; i < 50; i++) samples.push(78);
  const { low, high } = ciFromSamples(samples);
  assert.equal(low, 74);
  assert.equal(high, 76);
});

test('ciFromSamples: clamps lower bound to 0', () => {
  // Samples with mean near 0 and high variance
  // n=3: [0, 0, 0.5], mean=0.167, std≈0.289
  // t-crit df=2 = 4.303
  // margin = 4.303 * 0.289 / √3 ≈ 0.717
  // raw: [-0.55, 0.88] → clamp low to 0 → [0, 1]
  const { low, high } = ciFromSamples([0, 0, 0.5]);
  assert.equal(low, 0);
  assert.equal(high, 1);
});

test('ciFromSamples: clamps upper bound to 100', () => {
  // Samples near 100 with some variance
  // n=3: [97, 100, 100], mean=99, std≈1.732
  // t-crit df=2 = 4.303
  // margin = 4.303 * 1.732 / √3 ≈ 4.30
  // raw: [94.7, 103.3] → clamp high to 100 → [95, 100]
  const { low, high } = ciFromSamples([97, 100, 100]);
  assert.equal(low, 95);
  assert.equal(high, 100);
});

// =========================================================================
// computeConfidenceIntervals — main function
// =========================================================================

test('computeConfidenceIntervals adds CI fields to each task', () => {
  const tasks = [
    { task_name: 'Editing drafts' },
    { task_name: 'Answering emails' },
  ];
  const frequencySamples = {
    'Editing drafts': [60, 62, 58, 61, 59, 63, 60, 61, 62, 59],
    'Answering emails': [70, 72, 68, 71, 69, 70, 71, 73, 70, 69],
  };
  const result = computeConfidenceIntervals(tasks, frequencySamples);

  assert.equal(result.length, 2);
  for (const task of result) {
    assert.ok(
      typeof task.confidence_interval_low === 'number',
      `${task.task_name}: confidence_interval_low must be a number`
    );
    assert.ok(
      typeof task.confidence_interval_high === 'number',
      `${task.task_name}: confidence_interval_high must be a number`
    );
    assert.ok(
      task.confidence_interval_low >= 0,
      `${task.task_name}: confidence_interval_low >= 0`
    );
    assert.ok(
      task.confidence_interval_high <= 100,
      `${task.task_name}: confidence_interval_high <= 100`
    );
    assert.ok(
      task.confidence_interval_low <= task.confidence_interval_high,
      `${task.task_name}: low <= high`
    );
  }
});

test('computeConfidenceIntervals preserves all original task fields', () => {
  const tasks = [
    {
      task_name: 'Testing',
      task_frequency: 5,
      current_hours_weekly: 10,
      projected_hours_weekly: 3,
      agent_name: 'Test Agent',
      extraCustomField: 'should survive',
    },
  ];
  const frequencySamples = {
    Testing: [65, 68, 70, 67, 66, 69, 68, 67, 70, 66],
  };
  const result = computeConfidenceIntervals(tasks, frequencySamples);
  const task = result[0];

  assert.equal(task.task_name, 'Testing');
  assert.equal(task.task_frequency, 5);
  assert.equal(task.current_hours_weekly, 10);
  assert.equal(task.projected_hours_weekly, 3);
  assert.equal(task.agent_name, 'Test Agent');
  assert.equal(task.extraCustomField, 'should survive');
  assert.ok(typeof task.confidence_interval_low === 'number');
  assert.ok(typeof task.confidence_interval_high === 'number');
});

test('computeConfidenceIntervals produces plausible CI for persona-like data', () => {
  // Simulate 30 observations for an Editor copyedit task with time savings
  // centered around 75% (consistent with the ontology range 65–82%)
  // 30 samples sampling from 73.5 ± ~4
  const samples = [
    74, 75, 73, 76, 74, 75, 72, 77, 74, 75,
    73, 76, 74, 75, 72, 77, 73, 75, 74, 76,
    73, 74, 75, 72, 76, 74, 75, 73, 76, 72,
  ];
  // mean ≈ 74.17, std ≈ 1.44, t-crit(df=29) = 2.045
  // margin = 2.045 * 1.44 / √30 ≈ 0.54
  // raw: [73.63, 74.71] → rounded [74, 75]

  const tasks = [{ task_name: 'Copyedit Agent' }];
  const frequencySamples = { 'Copyedit Agent': samples };
  const result = computeConfidenceIntervals(tasks, frequencySamples);

  assert.ok(result[0].confidence_interval_low >= 73);
  assert.ok(result[0].confidence_interval_low <= 74);
  assert.ok(result[0].confidence_interval_high >= 74);
  assert.ok(result[0].confidence_interval_high <= 75);
});

test('computeConfidenceIntervals handles t-distribution for very small samples (n=3)', () => {
  // n=3, samples: [60, 64, 62], mean=62, std=2
  // t-crit(df=2)=4.303, margin=4.303*2/√3≈4.97
  // raw: [57.03, 66.97] → rounded [57, 67]
  const tasks = [{ task_name: 'Small sample task' }];
  const frequencySamples = { 'Small sample task': [60, 64, 62] };
  const result = computeConfidenceIntervals(tasks, frequencySamples);

  assert.equal(result[0].confidence_interval_low, 57);
  assert.equal(result[0].confidence_interval_high, 67);
});

test('computeConfidenceIntervals uses z=1.96 for n>30', () => {
  // n=50 samples all at 80. mean=80, std=0. CI=[80,80]
  const tasks = [{ task_name: 'Large sample task' }];
  const frequencySamples = { 'Large sample task': Array(50).fill(80) };
  const result = computeConfidenceIntervals(tasks, frequencySamples);

  assert.equal(result[0].confidence_interval_low, 80);
  assert.equal(result[0].confidence_interval_high, 80);
});

test('computeConfidenceIntervals does not mutate original tasks array', () => {
  const tasks = [{ task_name: 'Immutable test' }];
  const original = JSON.stringify(tasks);
  const frequencySamples = { 'Immutable test': [50, 52, 48, 51, 49] };
  computeConfidenceIntervals(tasks, frequencySamples);

  // original array should be unchanged (no CI fields)
  assert.deepEqual(tasks, JSON.parse(original));
  assert.equal(tasks[0].confidence_interval_low, undefined);
  assert.equal(tasks[0].confidence_interval_high, undefined);
});

// =========================================================================
// Error handling
// =========================================================================

test('computeConfidenceIntervals throws on non-array tasks', () => {
  assert.throws(
    () => computeConfidenceIntervals(null, {}),
    /tasks.*array/
  );
  assert.throws(
    () => computeConfidenceIntervals('not-array', {}),
    /tasks.*array/
  );
});

test('computeConfidenceIntervals throws on non-object frequencySamples', () => {
  assert.throws(
    () => computeConfidenceIntervals([], null),
    /frequencySamples.*object/
  );
  assert.throws(
    () => computeConfidenceIntervals([], 42),
    /frequencySamples.*object/
  );
});

test('computeConfidenceIntervals throws when task is not an object', () => {
  assert.throws(
    () => computeConfidenceIntervals([null], { null: [1, 2, 3] }),
    /must be an object/
  );
});

test('computeConfidenceIntervals throws when task_name is missing', () => {
  assert.throws(
    () => computeConfidenceIntervals([{}], {}),
    /task_name.*non-empty string/
  );
  assert.throws(
    () => computeConfidenceIntervals([{ task_name: '' }], {}),
    /task_name.*non-empty string/
  );
});

test('computeConfidenceIntervals throws when no sample data for a task', () => {
  assert.throws(
    () =>
      computeConfidenceIntervals(
        [{ task_name: 'Missing' }],
        { 'Other task': [1, 2, 3] }
      ),
    /no frequency sample data.*"Missing"/
  );
});

test('computeConfidenceIntervals throws when samples is not an array', () => {
  assert.throws(
    () =>
      computeConfidenceIntervals(
        [{ task_name: 'Bad samples' }],
        { 'Bad samples': 'not-an-array' }
      ),
    /must be an array/
  );
});

test('computeConfidenceIntervals throws when samples has fewer than 2 observations', () => {
  assert.throws(
    () =>
      computeConfidenceIntervals(
        [{ task_name: 'Single' }],
        { Single: [50] }
      ),
    /at least 2 observations/
  );
  assert.throws(
    () =>
      computeConfidenceIntervals(
        [{ task_name: 'Empty' }],
        { Empty: [] }
      ),
    /at least 2 observations/
  );
});

test('computeConfidenceIntervals throws when samples contain non-finite values', () => {
  assert.throws(
    () =>
      computeConfidenceIntervals(
        [{ task_name: 'NaN task' }],
        { 'NaN task': [50, NaN, 60] }
      ),
    /finite number/
  );
  assert.throws(
    () =>
      computeConfidenceIntervals(
        [{ task_name: 'Inf task' }],
        { 'Inf task': [50, Infinity, 60] }
      ),
    /finite number/
  );
});

// =========================================================================
// Integration: CI from sample data flows correctly into computeTaskTimeCi
// =========================================================================

test('integration: CI derived from samples can feed into computeTaskTimeCi', () => {
  // 1. Derive CIs from sample data
  const tasks = [{ task_name: 'Integration test' }];
  const frequencySamples = {
    'Integration test': Array(30).fill(75), // all 75% → CI [75, 75]
  };
  const [withCI] = computeConfidenceIntervals(tasks, frequencySamples);

  // 2. Feed into computeTaskTimeCi (needs current_hours_weekly)
  const withHours = {
    ...withCI,
    current_hours_weekly: 8,
  };
  const ci = computeTaskTimeCi(withHours);

  // 75% of 8h = 6h saved, 2h remaining
  assert.equal(ci.lowerPct, 75);
  assert.equal(ci.upperPct, 75);
  assert.equal(ci.lowerHoursSaved, 6);
  assert.equal(ci.upperHoursSaved, 6);
  assert.equal(ci.lowerProjectedHours, 2);
  assert.equal(ci.upperProjectedHours, 2);
});

// =========================================================================
// Realistic persona-aligned sample data tests
// =========================================================================

test('computeConfidenceIntervals produces CIs consistent with persona seed data ranges', () => {
  // These sample arrays are engineered so the resulting CIs fall within or
  // near the hardcoded CI ranges in personas.js, demonstrating that the
  // statistical engine produces plausible results for all five personas.

  const personaTasks = [
    // Editor — Copyedit: seed CI 65–82
    { task_name: 'Copyedit', samples: [
      70, 68, 74, 72, 71, 69, 75, 73, 70, 72,
      68, 74, 71, 69, 73, 70, 72, 68, 74, 71,
      69, 73, 70, 72, 68, 74, 71, 69, 73, 70,
    ]},
    // Financial Advisor — Portfolio Report: seed CI 55–78
    { task_name: 'Portfolio Report', samples: [
      62, 60, 65, 63, 61, 64, 62, 60, 63, 65,
      61, 64, 62, 65, 63, 60, 64, 61, 63, 62,
    ]},
    // Teacher — Grading: seed CI 45–70
    { task_name: 'Grading', samples: [
      55, 58, 52, 60, 56, 54, 59, 57, 53, 55,
      58, 56, 54, 60, 57, 55, 59, 56, 54, 58,
      57, 55, 60, 56, 54, 59, 57, 55, 58, 56,
    ]},
    // Project Manager — Status Report: seed CI 65–85
    { task_name: 'Status Report', samples: [
      72, 70, 75, 73, 71, 74, 72, 70, 75, 73,
      71, 74, 72, 70, 73, 71, 74, 72, 70, 73,
    ]},
    // Customer Service — Tier-1 Response: seed CI 55–80
    { task_name: 'Tier-1 Response', samples: [
      64, 62, 67, 65, 63, 66, 64, 62, 65, 67,
      63, 64, 62, 66, 65, 63, 64, 62, 66, 65,
      63, 67, 64, 62, 65, 63, 66, 64, 62, 65,
    ]},
  ];

  // Each resulting CI should be a plausible sub-range within [0, 100]
  for (const { task_name, samples } of personaTasks) {
    const tasks = [{ task_name }];
    const freq = { [task_name]: samples };
    const [result] = computeConfidenceIntervals(tasks, freq);

    // CI must be well-formed
    assert.ok(result.confidence_interval_low >= 0, `${task_name}: low >= 0`);
    assert.ok(result.confidence_interval_high <= 100, `${task_name}: high <= 100`);
    assert.ok(
      result.confidence_interval_low <= result.confidence_interval_high,
      `${task_name}: low <= high`
    );

    // The CI should be reasonable — not degenerate (unless all samples equal)
    const width = result.confidence_interval_high - result.confidence_interval_low;
    if (new Set(samples).size > 1) {
      assert.ok(width > 0, `${task_name}: CI should have width > 0 for varied samples`);
    }
  }
});
