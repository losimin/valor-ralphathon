// AgentStart — KPI calculation module.
//
// Centralizes the time-saved and ROI math so the Step 2 dashboard, the agent
// configuration screen, and the final completion screen all derive their
// top-line numbers from one place. Inputs come from the hardcoded persona
// data in `src/data/personas.js`; outputs are the dollar-converted figures
// that the wizard surfaces to the user.
//
// All percentages are returned as whole numbers (rounded) to match the
// UI presentation in Step 2. ROI values are integer USD.
//
// Reference grounding for the underlying time-saved estimates:
//   - Eloundou et al. (2023), arXiv:2303.10130
//   - Anthropic Economic Index reports (2024–2025)

const WEEKS_PER_MONTH = 4.33; // standard 52/12 conversion

function ensureTasks(persona) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('kpi: `persona` must be an object');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('kpi: `persona.tasks` must be an array');
  }
  if (typeof persona.hourly_rate !== 'number') {
    throw new Error('kpi: `persona.hourly_rate` must be a number');
  }
}

/** Hours saved per week for a single task. */
function hoursSavedWeekly(task) {
  return task.current_hours_weekly - task.projected_hours_weekly;
}

/** Whole-percent time saved on a single task (rounded). */
function taskTimeSavedPct(task) {
  if (!task.current_hours_weekly) return 0;
  return Math.round(
    (hoursSavedWeekly(task) / task.current_hours_weekly) * 100
  );
}

/** Weekly ROI (USD) for a single task, given a persona hourly rate. */
function taskRoiWeekly(task, hourlyRate) {
  return Math.round(hoursSavedWeekly(task) * hourlyRate);
}

/** Monthly ROI (USD) for a single task. */
function taskRoiMonthly(task, hourlyRate) {
  return Math.round(taskRoiWeekly(task, hourlyRate) * WEEKS_PER_MONTH);
}

const WEEKS_PER_YEAR = 52;

/** Annual ROI (USD) for a single task. */
function taskRoiAnnual(task, hourlyRate) {
  return Math.round(hoursSavedWeekly(task) * hourlyRate * WEEKS_PER_YEAR);
}

/**
 * Compute the persona-level KPI bundle that Step 2 renders:
 *   totalCurrentHours, totalProjectedHours, hoursSavedWeekly,
 *   timeSavedPct, tasksAutomated, totalTasks, roiWeekly, roiMonthly,
 *   roiAnnual.
 *
 * Aggregates over `persona.tasks` and rounds percentages to whole numbers.
 * ROI values are summed from per-task integer ROI so the dashboard total
 * equals the visible per-row sum (no off-by-one rounding surprises).
 *
 * tasksAutomated counts tasks whose `agent_enabled` flag is true
 * (i.e. automation_confidence ≥ 80%).
 */
function computePersonaKpis(persona) {
  ensureTasks(persona);

  let totalCurrent = 0;
  let totalProjected = 0;
  let roiWeekly = 0;
  let roiMonthly = 0;
  let roiAnnual = 0;
  let tasksAutomated = 0;

  for (const task of persona.tasks) {
    totalCurrent += task.current_hours_weekly;
    totalProjected += task.projected_hours_weekly;
    roiWeekly += taskRoiWeekly(task, persona.hourly_rate);
    roiMonthly += taskRoiMonthly(task, persona.hourly_rate);
    roiAnnual += taskRoiAnnual(task, persona.hourly_rate);
    if (task.agent_enabled) tasksAutomated += 1;
  }

  const hoursSaved = totalCurrent - totalProjected;
  const timeSavedPct = totalCurrent
    ? Math.round((hoursSaved / totalCurrent) * 100)
    : 0;
  const totalTasks = persona.tasks.length;

  return {
    totalCurrentHours: totalCurrent,
    totalProjectedHours: totalProjected,
    hoursSavedWeekly: hoursSaved,
    timeSavedPct,
    tasksAutomated,
    totalTasks,
    roiWeekly,
    roiMonthly,
    roiAnnual,
  };
}

module.exports = {
  WEEKS_PER_MONTH,
  WEEKS_PER_YEAR,
  hoursSavedWeekly,
  taskTimeSavedPct,
  taskRoiWeekly,
  taskRoiMonthly,
  taskRoiAnnual,
  computePersonaKpis,
};
