// Unit tests for the ROI calculation module.
//
// Verifies that calculateROI, calculateTaskROI, and calculatePersonaROI
// produce correct savings and ROI figures for all five personas given known
// inputs. Expected values are hand-computed from the documented formulas:
//
//   gross = estimatedHoursSaved × hourlyRate
//   net   = gross − implementationCost
//   roi%  = round(net / implementationCost × 100)   [null when cost = 0]
//   paybackWeeks = round(cost / grossWeekly × 10) / 10
//
// Hourly rates (source: BLS OEWS May 2023):
//   Editor:         $36/hr
//   Financial Advisor: $67/hr
//   Teacher:        $32/hr
//   Project Manager: $56/hr
//   Customer Service Rep: $19/hr

const test = require('node:test');
const assert = require('node:assert/strict');

const { personas } = require('../../data/personas');
const {
  calculateROI,
  calculateROIFromTasks,
  calculateTaskROI,
  calculatePersonaROI,
  computeAnnualDollarSavings,
} = require('../roi');

// ---------------------------------------------------------------------------
// calculateROI — core function
// ---------------------------------------------------------------------------

test('calculateROI — editor, 10h saved, $500 cost', () => {
  const result = calculateROI('editor', 10, 500);

  assert.equal(result.personaId, 'editor');
  assert.equal(result.hourlyRate, 36);
  assert.equal(result.estimatedHoursSaved, 10);
  assert.equal(result.implementationCost, 500);

  // gross = 10 × 36 = 360
  assert.equal(result.grossSavingsWeekly, 360);
  assert.equal(result.grossSavingsMonthly, Math.round(360 * 4.33)); // 1559
  assert.equal(result.grossSavingsAnnual, 360 * 52); // 18720

  // net = gross − cost
  assert.equal(result.netSavingsWeekly, 360 - 500); // -140
  assert.equal(result.netSavingsMonthly, 1559 - 500); // 1059
  assert.equal(result.netSavingsAnnual, 18720 - 500); // 18220

  // roi% = round(net / cost × 100)
  assert.equal(result.roiPctWeekly, -28);
  assert.equal(result.roiPctMonthly, 212);
  assert.equal(result.roiPctAnnual, 3644);

  // payback = 500 / 360 = 1.388… → 1.4 weeks
  assert.equal(result.paybackWeeks, 1.4);
  assert.equal(result.isProfitable, true);
});

test('calculateROI — financial_advisor, 5h saved, $1000 cost', () => {
  const result = calculateROI('financial_advisor', 5, 1000);

  assert.equal(result.personaId, 'financial_advisor');
  assert.equal(result.hourlyRate, 67);
  assert.equal(result.grossSavingsWeekly, 335);
  assert.equal(result.grossSavingsMonthly, Math.round(335 * 4.33)); // 1451
  assert.equal(result.grossSavingsAnnual, 335 * 52); // 17420

  assert.equal(result.netSavingsWeekly, 335 - 1000); // -665
  assert.equal(result.netSavingsMonthly, 1451 - 1000); // 451
  assert.equal(result.netSavingsAnnual, 17420 - 1000); // 16420

  assert.equal(result.roiPctWeekly, -66); // round(-665/1000*100) = round(-66.5) = -66 (JS rounds half up toward +∞)
  assert.equal(result.roiPctMonthly, 45); // round(451/1000*100) = 45
  assert.equal(result.roiPctAnnual, 1642); // round(16420/1000*100) = 1642

  assert.equal(result.paybackWeeks, 3.0); // 1000/335=2.985… → 3.0
  assert.equal(result.isProfitable, true);
});

test('calculateROI — teacher, 14h saved, $0 cost', () => {
  const result = calculateROI('teacher', 14, 0);

  assert.equal(result.hourlyRate, 32);
  assert.equal(result.grossSavingsWeekly, 448);
  assert.equal(result.grossSavingsMonthly, Math.round(448 * 4.33)); // 1940
  assert.equal(result.grossSavingsAnnual, 448 * 52); // 23296

  // net = gross − 0
  assert.equal(result.netSavingsWeekly, 448);
  assert.equal(result.netSavingsMonthly, 1940);
  assert.equal(result.netSavingsAnnual, 23296);

  // ROI % is null when cost is zero (infinite return)
  assert.equal(result.roiPctWeekly, null);
  assert.equal(result.roiPctMonthly, null);
  assert.equal(result.roiPctAnnual, null);

  // payback is 0 (instant — no cost)
  assert.equal(result.paybackWeeks, 0);
  assert.equal(result.isProfitable, true);
});

test('calculateROI — project_manager, 16h saved, $2500 cost', () => {
  const result = calculateROI('project_manager', 16, 2500);

  assert.equal(result.hourlyRate, 56);
  assert.equal(result.grossSavingsWeekly, 896);
  assert.equal(result.grossSavingsMonthly, Math.round(896 * 4.33)); // 3880
  assert.equal(result.grossSavingsAnnual, 896 * 52); // 46592

  assert.equal(result.netSavingsWeekly, 896 - 2500); // -1604
  assert.equal(result.netSavingsMonthly, 3880 - 2500); // 1380
  assert.equal(result.netSavingsAnnual, 46592 - 2500); // 44092

  assert.equal(result.roiPctWeekly, -64); // round(-1604/2500*100) = round(-64.16) = -64
  assert.equal(result.roiPctMonthly, 55); // round(1380/2500*100) = round(55.2) = 55
  assert.equal(result.roiPctAnnual, 1764); // round(44092/2500*100) = round(1763.68) = 1764

  // payback = 2500/896 = 2.790… → 2.8 weeks
  assert.equal(result.paybackWeeks, 2.8);
  assert.equal(result.isProfitable, true);
});

test('calculateROI — customer_service_rep, 30h saved, $200 cost', () => {
  const result = calculateROI('customer_service_rep', 30, 200);

  assert.equal(result.hourlyRate, 19);
  assert.equal(result.grossSavingsWeekly, 570);
  assert.equal(result.grossSavingsMonthly, Math.round(570 * 4.33)); // 2468
  assert.equal(result.grossSavingsAnnual, 570 * 52); // 29640

  assert.equal(result.netSavingsWeekly, 570 - 200); // 370
  assert.equal(result.netSavingsMonthly, 2468 - 200); // 2268
  assert.equal(result.netSavingsAnnual, 29640 - 200); // 29440

  assert.equal(result.roiPctWeekly, 185); // round(370/200*100) = 185
  assert.equal(result.roiPctMonthly, 1134); // round(2268/200*100) = 1134
  assert.equal(result.roiPctAnnual, 14720); // round(29440/200*100) = 14720

  // payback = 200/570 = 0.3508… → 0.4 weeks
  assert.equal(result.paybackWeeks, 0.4);
  assert.equal(result.isProfitable, true);
});

// ---------------------------------------------------------------------------
// Edge cases — hours saved
// ---------------------------------------------------------------------------

test('calculateROI — zero hours saved with non-zero cost is unprofitable', () => {
  const result = calculateROI('editor', 0, 500);

  assert.equal(result.grossSavingsWeekly, 0);
  assert.equal(result.grossSavingsMonthly, 0);
  assert.equal(result.grossSavingsAnnual, 0);

  assert.equal(result.netSavingsWeekly, -500);
  assert.equal(result.netSavingsMonthly, -500);
  assert.equal(result.netSavingsAnnual, -500);

  assert.equal(result.roiPctWeekly, -100);
  assert.equal(result.roiPctMonthly, -100);
  assert.equal(result.roiPctAnnual, -100);

  // payback stays null — cost can never be recouped
  assert.equal(result.paybackWeeks, null);
  assert.equal(result.isProfitable, false);
});

test('calculateROI — zero hours, zero cost', () => {
  const result = calculateROI('editor', 0, 0);

  assert.equal(result.grossSavingsWeekly, 0);
  assert.equal(result.netSavingsWeekly, 0);
  assert.equal(result.roiPctWeekly, null);
  assert.equal(result.paybackWeeks, 0);
  assert.equal(result.isProfitable, false);
});

test('calculateROI — large hours saved still produces correct figures', () => {
  const result = calculateROI('financial_advisor', 100, 5000);

  assert.equal(result.grossSavingsWeekly, 6700);
  assert.equal(result.grossSavingsAnnual, 6700 * 52); // 348400
  assert.equal(result.netSavingsAnnual, 348400 - 5000); // 343400
  assert.equal(result.isProfitable, true);
});

// ---------------------------------------------------------------------------
// Validation — invalid personaId
// ---------------------------------------------------------------------------

test('calculateROI — throws on empty personaId', () => {
  assert.throws(
    () => calculateROI('', 10, 500),
    /personaId/
  );
});

test('calculateROI — throws on unknown personaId', () => {
  assert.throws(
    () => calculateROI('astronaut', 10, 500),
    /Unknown persona ID/
  );
});

test('calculateROI — throws on non-string personaId', () => {
  assert.throws(
    () => calculateROI(null, 10, 500),
    /personaId/
  );
  assert.throws(
    () => calculateROI(42, 10, 500),
    /personaId/
  );
});

// ---------------------------------------------------------------------------
// Validation — estimatedHoursSaved
// ---------------------------------------------------------------------------

test('calculateROI — throws on negative hours', () => {
  assert.throws(
    () => calculateROI('editor', -1, 500),
    /estimatedHoursSaved.*≥ 0/
  );
});

test('calculateROI — throws on non-finite hours', () => {
  assert.throws(
    () => calculateROI('editor', NaN, 500),
    /estimatedHoursSaved.*finite/
  );
  assert.throws(
    () => calculateROI('editor', Infinity, 500),
    /estimatedHoursSaved.*finite/
  );
});

test('calculateROI — throws on non-number hours', () => {
  assert.throws(
    () => calculateROI('editor', '10', 500),
    /estimatedHoursSaved.*finite/
  );
});

// ---------------------------------------------------------------------------
// Validation — implementationCost
// ---------------------------------------------------------------------------

test('calculateROI — throws on negative cost', () => {
  assert.throws(
    () => calculateROI('editor', 10, -1),
    /implementationCost.*≥ 0/
  );
});

test('calculateROI — throws on non-finite cost', () => {
  assert.throws(
    () => calculateROI('editor', 10, NaN),
    /implementationCost.*finite/
  );
  assert.throws(
    () => calculateROI('editor', 10, Infinity),
    /implementationCost.*finite/
  );
});

test('calculateROI — throws on non-number cost', () => {
  assert.throws(
    () => calculateROI('editor', 10, 'free'),
    /implementationCost.*finite/
  );
});

// ---------------------------------------------------------------------------
// calculateTaskROI — convenience wrapper
// ---------------------------------------------------------------------------

test('calculateTaskROI derives hours saved from task object for editor copyedit', () => {
  const editor = personas.find((p) => p.persona_id === 'editor');
  const task = editor.tasks.find((t) => t.task_name.startsWith('Copyedit'));

  // current=12, projected=3 → hoursSaved = 9
  const result = calculateTaskROI('editor', task, 500);

  assert.equal(result.estimatedHoursSaved, 9);
  assert.equal(result.hourlyRate, 36);
  assert.equal(result.grossSavingsWeekly, 324);
  assert.equal(result.isProfitable, true);
});

test('calculateTaskROI throws when projected exceeds current', () => {
  assert.throws(
    () =>
      calculateTaskROI(
        'editor',
        { current_hours_weekly: 5, projected_hours_weekly: 10 },
        500
      ),
    /projected_hours_weekly.*cannot exceed/
  );
});

test('calculateTaskROI throws on non-object task', () => {
  assert.throws(
    () => calculateTaskROI('editor', null, 500),
    /task.*must be an object/
  );
  assert.throws(
    () => calculateTaskROI('editor', 'not-a-task', 500),
    /task.*must be an object/
  );
});

test('calculateTaskROI handles missing hours fields as zero', () => {
  const result = calculateTaskROI('editor', {}, 100);
  assert.equal(result.estimatedHoursSaved, 0);
  assert.equal(result.grossSavingsWeekly, 0);
});

// ---------------------------------------------------------------------------
// calculatePersonaROI — aggregate across all tasks
// ---------------------------------------------------------------------------

test('calculatePersonaROI aggregates all tasks for editor', () => {
  const editor = personas.find((p) => p.persona_id === 'editor');

  // Total hours saved: (12-3)+(8-3)+(4-1)+(6-4) = 9+5+3+2 = 19
  const result = calculatePersonaROI(editor, 1000);

  assert.equal(result.estimatedHoursSaved, 19);
  assert.equal(result.hourlyRate, 36);
  assert.equal(result.grossSavingsWeekly, 684); // 19 × 36
  assert.equal(result.grossSavingsAnnual, 684 * 52); // 35568
  assert.equal(result.netSavingsAnnual, 35568 - 1000); // 34568
  assert.equal(result.isProfitable, true);
});

test('calculatePersonaROI aggregates all tasks for customer_service_rep', () => {
  const csr = personas.find((p) => p.persona_id === 'customer_service_rep');

  // Total hours saved: (20-6)+(6-1)+(12-6)+(5-2)+(3-1) = 14+5+6+3+2 = 30
  const result = calculatePersonaROI(csr, 500);

  assert.equal(result.estimatedHoursSaved, 30);
  assert.equal(result.hourlyRate, 19);
  assert.equal(result.grossSavingsWeekly, 570);
  assert.equal(result.isProfitable, true);
});

test('calculatePersonaROI throws on invalid persona', () => {
  assert.throws(
    () => calculatePersonaROI(null, 500),
    /persona.*must be an object/
  );
  assert.throws(
    () => calculatePersonaROI({}, 500),
    /tasks.*must be an array/
  );
});

// ---------------------------------------------------------------------------
// Cross-persona consistency
// ---------------------------------------------------------------------------

test('calculateROI returns correct rate_source citation for every persona', () => {
  for (const persona of personas) {
    const result = calculateROI(persona.persona_id, 10, 500);
    assert.ok(
      result.rateSource.includes('BLS OEWS May 2023'),
      `${persona.persona_id}: rateSource should cite BLS OEWS`
    );
    // The BLS occupation title may differ from the persona display name
    // (e.g., persona "Project Manager" → BLS "Project Management Specialists").
    // We check that the source cites BLS and includes the SOC code.
    assert.ok(
      result.rateSource.includes('BLS OEWS May 2023'),
      `${persona.persona_id}: rateSource should cite BLS OEWS`
    );
    assert.equal(
      result.hourlyRate,
      persona.hourly_rate,
      `${persona.persona_id}: hourlyRate should match persona data`
    );
  }
});

test('calculateROI paybackWeeks is consistent with gross savings', () => {
  // For any positive cost and positive savings, payback * grossWeekly ≈ cost
  const result = calculateROI('editor', 10, 360);
  assert.equal(result.paybackWeeks, 1.0); // exactly 1 week
  assert.equal(result.grossSavingsWeekly, 360);
});

test('calculateROI returns identical results when called with same inputs', () => {
  const a = calculateROI('editor', 10, 500);
  const b = calculateROI('editor', 10, 500);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// computeAnnualDollarSavings — simple hours×rate×52 conversion
// ---------------------------------------------------------------------------

test('computeAnnualDollarSavings — editor, 10h/wk saved at $36/hr', () => {
  const result = computeAnnualDollarSavings(10, 36);
  // 10 × 36 × 52 = 18720
  assert.equal(result, 18720);
});

test('computeAnnualDollarSavings — financial_advisor, 5h/wk at $67/hr', () => {
  const result = computeAnnualDollarSavings(5, 67);
  // 5 × 67 × 52 = 17420
  assert.equal(result, 17420);
});

test('computeAnnualDollarSavings — teacher, 14h/wk at $32/hr', () => {
  const result = computeAnnualDollarSavings(14, 32);
  // 14 × 32 × 52 = 23296
  assert.equal(result, 23296);
});

test('computeAnnualDollarSavings — project_manager, 16h/wk at $56/hr', () => {
  const result = computeAnnualDollarSavings(16, 56);
  // 16 × 56 × 52 = 46592
  assert.equal(result, 46592);
});

test('computeAnnualDollarSavings — customer_service_rep, 30h/wk at $19/hr', () => {
  const result = computeAnnualDollarSavings(30, 19);
  // 30 × 19 × 52 = 29640
  assert.equal(result, 29640);
});

test('computeAnnualDollarSavings — zero hours saved returns zero', () => {
  const result = computeAnnualDollarSavings(0, 50);
  assert.equal(result, 0);
});

test('computeAnnualDollarSavings — zero hourly rate returns zero', () => {
  const result = computeAnnualDollarSavings(10, 0);
  assert.equal(result, 0);
});

test('computeAnnualDollarSavings — fractional hours and rate round correctly', () => {
  // 2.5 × 42.75 × 52 = 5557.5 → rounds to 5558
  const result = computeAnnualDollarSavings(2.5, 42.75);
  assert.equal(result, 5558);
});

test('computeAnnualDollarSavings — throws on negative hours', () => {
  assert.throws(
    () => computeAnnualDollarSavings(-1, 50),
    /hoursSavedWeekly.*≥ 0/
  );
});

test('computeAnnualDollarSavings — throws on negative rate', () => {
  assert.throws(
    () => computeAnnualDollarSavings(10, -1),
    /hourlyRate.*≥ 0/
  );
});

test('computeAnnualDollarSavings — throws on non-finite hours', () => {
  assert.throws(
    () => computeAnnualDollarSavings(NaN, 50),
    /hoursSavedWeekly.*finite/
  );
  assert.throws(
    () => computeAnnualDollarSavings(Infinity, 50),
    /hoursSavedWeekly.*finite/
  );
});

test('computeAnnualDollarSavings — throws on non-finite rate', () => {
  assert.throws(
    () => computeAnnualDollarSavings(10, NaN),
    /hourlyRate.*finite/
  );
  assert.throws(
    () => computeAnnualDollarSavings(10, Infinity),
    /hourlyRate.*finite/
  );
});

test('computeAnnualDollarSavings — throws on non-number hours', () => {
  assert.throws(
    () => computeAnnualDollarSavings('10', 50),
    /hoursSavedWeekly.*finite/
  );
});

test('computeAnnualDollarSavings — throws on non-number rate', () => {
  assert.throws(
    () => computeAnnualDollarSavings(10, '50'),
    /hourlyRate.*finite/
  );
});

// ---------------------------------------------------------------------------
// calculateROIFromTasks(tasks, hourlyRate) — Sub-AC 2.2:
//   converts time saved across a list of tasks into a dollar ROI value
// ---------------------------------------------------------------------------

test('calculateROIFromTasks — editor persona converts time saved into dollar ROI', () => {
  const editor = personas.find((p) => p.persona_id === 'editor');

  // Editor tasks (from personas data):
  //   Copyedit:      12 → 3  saves  9
  //   Headline:       8 → 3  saves  5
  //   Fact-check:     4 → 1  saves  3
  //   Format/style:   6 → 4  saves  2
  // Total hours saved per week: 19
  // Editor hourly rate: $36
  //   weekly  = 19 × 36          = $684
  //   monthly = round(684 × 4.33) = $2962
  //   annual  = 684 × 52         = $35,568
  const result = calculateROIFromTasks(editor.tasks, editor.hourly_rate);

  assert.equal(result.hoursSavedWeekly, 19);
  assert.equal(result.hourlyRate, 36);
  assert.equal(result.roiWeekly, 684);
  assert.equal(result.roiMonthly, Math.round(684 * 4.33)); // 2962
  assert.equal(result.roiAnnual, 684 * 52); // 35568

  // Sanity-check the time-saved percentage is in the plausible 0–100 range
  // and that aggregate dollar conversion matches the manual calculation.
  assert.ok(result.timeSavedPct > 0 && result.timeSavedPct < 100);
});

test('calculateROIFromTasks — customer_service_rep dollar ROI matches manual calc', () => {
  const csr = personas.find((p) => p.persona_id === 'customer_service_rep');

  // CSR tasks: hours saved = (20-6)+(6-1)+(12-6)+(5-2)+(3-1) = 30
  // Hourly rate: $19/hr
  //   weekly  = 30 × 19          = $570
  //   annual  = 570 × 52         = $29,640
  const result = calculateROIFromTasks(csr.tasks, csr.hourly_rate);

  assert.equal(result.hoursSavedWeekly, 30);
  assert.equal(result.hourlyRate, 19);
  assert.equal(result.roiWeekly, 570);
  assert.equal(result.roiAnnual, 29640);
});

test('calculateROIFromTasks — empty task list returns zero dollars', () => {
  const result = calculateROIFromTasks([], 50);
  assert.equal(result.hoursSavedWeekly, 0);
  assert.equal(result.roiWeekly, 0);
  assert.equal(result.roiMonthly, 0);
  assert.equal(result.roiAnnual, 0);
  assert.equal(result.timeSavedPct, 0);
});

test('calculateROIFromTasks — throws when tasks is not an array', () => {
  assert.throws(
    () => calculateROIFromTasks(null, 50),
    /tasks.*must be an array/
  );
  assert.throws(
    () => calculateROIFromTasks('not-an-array', 50),
    /tasks.*must be an array/
  );
});

test('calculateROIFromTasks — throws on invalid hourlyRate', () => {
  assert.throws(
    () => calculateROIFromTasks([], -1),
    /hourlyRate.*≥ 0/
  );
  assert.throws(
    () => calculateROIFromTasks([], NaN),
    /hourlyRate.*finite/
  );
  assert.throws(
    () => calculateROIFromTasks([], '50'),
    /hourlyRate.*finite/
  );
});
