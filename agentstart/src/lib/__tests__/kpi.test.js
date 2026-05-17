// Unit tests for the KPI calculation module.
//
// Verifies that computePersonaKpis produces the expected % time saved and
// ROI dollar values for each of the five seeded personas. Expected numbers
// below were hand-computed from the hardcoded task hours and hourly rates
// in `src/data/personas.js` using the documented formulas:
//   hours_saved      = sum(current_hours_weekly - projected_hours_weekly)
//   time_saved_pct   = round(hours_saved / total_current_hours * 100)
//   roi_weekly       = sum(round(hours_saved_task * hourly_rate))
//   roi_monthly      = sum(round(roi_weekly_task * 4.33))

const test = require('node:test');
const assert = require('node:assert/strict');

const { personas } = require('../../data/personas');
const { computePersonaKpis, taskRoiAnnual } = require('../kpi');

const EXPECTED = {
  editor: {
    totalCurrentHours: 30,
    totalProjectedHours: 11,
    hoursSavedWeekly: 19,
    timeSavedPct: 63,
    tasksAutomated: 2,
    totalTasks: 4,
    roiWeekly: 684,
    roiMonthly: 2962,
    roiAnnual: 35568,
  },
  financial_advisor: {
    totalCurrentHours: 28,
    totalProjectedHours: 10,
    hoursSavedWeekly: 18,
    timeSavedPct: 64,
    tasksAutomated: 3,
    totalTasks: 4,
    roiWeekly: 1206,
    roiMonthly: 5222,
    roiAnnual: 62712,
  },
  teacher: {
    totalCurrentHours: 23,
    totalProjectedHours: 9,
    hoursSavedWeekly: 14,
    timeSavedPct: 61,
    tasksAutomated: 3,
    totalTasks: 4,
    roiWeekly: 448,
    roiMonthly: 1939,
    roiAnnual: 23296,
  },
  project_manager: {
    totalCurrentHours: 23,
    totalProjectedHours: 7,
    hoursSavedWeekly: 16,
    timeSavedPct: 70,
    tasksAutomated: 3,
    totalTasks: 5,
    roiWeekly: 896,
    roiMonthly: 3878,
    roiAnnual: 46592,
  },
  customer_service_rep: {
    totalCurrentHours: 46,
    totalProjectedHours: 16,
    hoursSavedWeekly: 30,
    timeSavedPct: 65,
    tasksAutomated: 4,
    totalTasks: 5,
    roiWeekly: 570,
    roiMonthly: 2469,
    roiAnnual: 29640,
  },
};

test('computePersonaKpis matches expected values for all five personas', () => {
  assert.equal(personas.length, 5, 'expected exactly five personas');
  for (const persona of personas) {
    const expected = EXPECTED[persona.persona_id];
    assert.ok(
      expected,
      `no expected KPI fixture for persona ${persona.persona_id}`
    );
    const got = computePersonaKpis(persona);
    assert.deepEqual(
      got,
      expected,
      `KPI mismatch for ${persona.persona_id}: ${JSON.stringify(got)}`
    );
  }
});

test('computePersonaKpis throws on invalid input', () => {
  assert.throws(() => computePersonaKpis(null), /persona/);
  assert.throws(
    () => computePersonaKpis({ hourly_rate: 10 }),
    /tasks/
  );
  assert.throws(
    () => computePersonaKpis({ tasks: [], hourly_rate: 'x' }),
    /hourly_rate/
  );
});

test('computePersonaKpis handles zero-hour edge case', () => {
  const kpis = computePersonaKpis({
    hourly_rate: 50,
    tasks: [
      { current_hours_weekly: 0, projected_hours_weekly: 0 },
    ],
  });
  assert.equal(kpis.timeSavedPct, 0);
  assert.equal(kpis.tasksAutomated, 0);
  assert.equal(kpis.totalTasks, 1);
  assert.equal(kpis.roiWeekly, 0);
  assert.equal(kpis.roiMonthly, 0);
  assert.equal(kpis.roiAnnual, 0);
});

// ---------------------------------------------------------------------------
// taskRoiAnnual — annual dollar conversion for a single task
// ---------------------------------------------------------------------------

test('taskRoiAnnual computes annual savings from task and hourly rate', () => {
  // 6 hours saved/week × $56/hr × 52 weeks = 17472
  const result = taskRoiAnnual(
    { current_hours_weekly: 6, projected_hours_weekly: 0 },
    56
  );
  assert.equal(result, 17472);
});

test('taskRoiAnnual rounds to nearest whole dollar', () => {
  // 1.7 hours × $19.15/hr × 52 = 1692.86 → rounds to 1693
  const result = taskRoiAnnual(
    { current_hours_weekly: 2.5, projected_hours_weekly: 0.8 },
    19.15
  );
  // hoursSaved = 1.7, 1.7 * 19.15 * 52 = 1692.86 → 1693
  assert.equal(result, 1693);
});

test('taskRoiAnnual returns zero when no hours saved', () => {
  const result = taskRoiAnnual(
    { current_hours_weekly: 5, projected_hours_weekly: 5 },
    50
  );
  assert.equal(result, 0);
});

test('taskRoiAnnual — validates against computeAnnualDollarSavings for all personas', () => {
  const { computeAnnualDollarSavings } = require('../roi');
  for (const persona of personas) {
    for (const task of persona.tasks) {
      const hoursSaved = task.current_hours_weekly - task.projected_hours_weekly;
      const fromKpi = taskRoiAnnual(task, persona.hourly_rate);
      const fromRoi = computeAnnualDollarSavings(hoursSaved, persona.hourly_rate);
      assert.equal(
        fromKpi,
        fromRoi,
        `${persona.persona_id}/${task.task_name}: taskRoiAnnual=${fromKpi} != computeAnnualDollarSavings=${fromRoi}`
      );
    }
  }
});
