// AgentStart — ROI calculation module.
//
// Provides a standalone `calculateROI` function that accepts a role
// (persona ID), estimated hours saved, and an implementation cost, then
// computes ROI using the role-specific hourly rate from the hourlyRates
// data module. This is the canonical function for answering "what is the
// return on investing in this agent for this role?"
//
// The function computes:
//   gross_savings = estimated_hours_saved × hourly_rate
//   net_savings   = gross_savings − implementation_cost
//   roi_pct       = (net_savings / implementation_cost) × 100
//
// Results are returned for weekly, monthly (4.33 weeks), and annual (52
// weeks) time horizons. The payback period (weeks until implementation cost
// is recouped) is also included.
//
// Hourly-rate sourcing:
//   U.S. Bureau of Labor Statistics, OEWS May 2023 release.
//   https://www.bls.gov/oes/current/oes_nat.htm
//
// Efficiency reference for hours-saved estimates:
//   - Eloundou et al. (2023), "GPTs are GPTs," arXiv:2303.10130.
//   - Anthropic Economic Index (2024–2025).

const { getHourlyRate, lookupRate } = require('../data/hourlyRates');
const { calculateTimeSaved } = require('./timeSavings');

const WEEKS_PER_MONTH = 4.33; // standard 52/12
const WEEKS_PER_YEAR = 52;

/**
 * Calculate ROI for deploying an AI agent for a given persona role.
 *
 * @param {string} personaId — one of: editor, financial_advisor, teacher,
 *   project_manager, customer_service_rep
 * @param {number} estimatedHoursSaved — weekly hours the agent is expected
 *   to save (must be ≥ 0)
 * @param {number} implementationCost — one-time cost in USD to set up and
 *   deploy the agent (must be ≥ 0)
 * @returns {{
 *   personaId: string,
 *   hourlyRate: number,
 *   rateSource: string,
 *   estimatedHoursSaved: number,
 *   implementationCost: number,
 *   grossSavingsWeekly: number,
 *   grossSavingsMonthly: number,
 *   grossSavingsAnnual: number,
 *   netSavingsWeekly: number,
 *   netSavingsMonthly: number,
 *   netSavingsAnnual: number,
 *   roiPctWeekly: number,
 *   roiPctMonthly: number,
 *   roiPctAnnual: number,
 *   paybackWeeks: number | null,
 *   isProfitable: boolean,
 * }}
 * @throws {Error} if personaId is not a recognized role, or if numeric
 *   arguments are negative or non-finite.
 */
function calculateROI(personaId, estimatedHoursSaved, implementationCost) {
  // --- validation -----------------------------------------------------------
  if (typeof personaId !== 'string' || personaId.length === 0) {
    throw new Error(
      'calculateROI: `personaId` must be a non-empty string'
    );
  }

  if (typeof estimatedHoursSaved !== 'number' || !Number.isFinite(estimatedHoursSaved)) {
    throw new Error(
      'calculateROI: `estimatedHoursSaved` must be a finite number'
    );
  }
  if (estimatedHoursSaved < 0) {
    throw new Error(
      'calculateROI: `estimatedHoursSaved` must be ≥ 0'
    );
  }

  if (typeof implementationCost !== 'number' || !Number.isFinite(implementationCost)) {
    throw new Error(
      'calculateROI: `implementationCost` must be a finite number'
    );
  }
  if (implementationCost < 0) {
    throw new Error(
      'calculateROI: `implementationCost` must be ≥ 0'
    );
  }

  // --- rate lookup ----------------------------------------------------------
  const { hourly_rate: hourlyRate, rate_source: rateSource } =
    lookupRate(personaId);

  // --- savings math ---------------------------------------------------------
  const grossSavingsWeekly = Math.round(estimatedHoursSaved * hourlyRate);
  const grossSavingsMonthly = Math.round(grossSavingsWeekly * WEEKS_PER_MONTH);
  const grossSavingsAnnual = grossSavingsWeekly * WEEKS_PER_YEAR;

  const netSavingsWeekly = grossSavingsWeekly - implementationCost;
  const netSavingsMonthly = grossSavingsMonthly - implementationCost;
  const netSavingsAnnual = grossSavingsAnnual - implementationCost;

  // --- ROI percentage -------------------------------------------------------
  // ROI % = (net / cost) × 100. When cost is zero the return is infinite;
  // we cap the display at null and signal "no upfront cost" via isProfitable.
  let roiPctWeekly = null;
  let roiPctMonthly = null;
  let roiPctAnnual = null;

  if (implementationCost > 0) {
    roiPctWeekly = Math.round((netSavingsWeekly / implementationCost) * 100);
    roiPctMonthly = Math.round((netSavingsMonthly / implementationCost) * 100);
    roiPctAnnual = Math.round((netSavingsAnnual / implementationCost) * 100);
  }

  // --- payback period (weeks) -----------------------------------------------
  // How many weeks until gross savings recoup the implementation cost.
  let paybackWeeks = null;
  if (implementationCost === 0) {
    paybackWeeks = 0; // instant — no cost to recoup
  } else if (grossSavingsWeekly > 0) {
    paybackWeeks = Math.round(
      (implementationCost / grossSavingsWeekly) * 10
    ) / 10; // one decimal place
  }
  // If grossSavingsWeekly === 0 and cost > 0, paybackWeeks stays null
  // (never recouped).

  // --- profitability --------------------------------------------------------
  const isProfitable = netSavingsAnnual > 0;

  return {
    personaId,
    hourlyRate,
    rateSource,
    estimatedHoursSaved,
    implementationCost,
    grossSavingsWeekly,
    grossSavingsMonthly,
    grossSavingsAnnual,
    netSavingsWeekly,
    netSavingsMonthly,
    netSavingsAnnual,
    roiPctWeekly,
    roiPctMonthly,
    roiPctAnnual,
    paybackWeeks,
    isProfitable,
  };
}

/**
 * Convenience wrapper: calculate ROI from a full persona task object.
 *
 * Derives `estimatedHoursSaved` from the task's
 * `current_hours_weekly − projected_hours_weekly`. The persona's
 * `persona_id` and `hourly_rate` are read from the data module so the
 * caller only needs to supply the task and the implementation cost.
 *
 * @param {string} personaId
 * @param {object} task — a task object with current_hours_weekly and
 *   projected_hours_weekly fields
 * @param {number} implementationCost
 * @returns {object} same shape as calculateROI return value
 */
function calculateTaskROI(personaId, task, implementationCost) {
  if (!task || typeof task !== 'object') {
    throw new Error('calculateTaskROI: `task` must be an object');
  }
  const hoursSaved =
    (task.current_hours_weekly || 0) - (task.projected_hours_weekly || 0);
  if (hoursSaved < 0) {
    throw new Error(
      'calculateTaskROI: `projected_hours_weekly` cannot exceed `current_hours_weekly`'
    );
  }
  return calculateROI(personaId, hoursSaved, implementationCost);
}

/**
 * Calculate aggregate ROI across all tasks for a persona.
 *
 * Sums hours saved across all tasks and computes a single ROI figure for
 * the given implementation cost. Useful for answering "if I deploy all
 * agents for this persona at a bundled cost, what is the overall ROI?"
 *
 * @param {object} persona — a full persona object from personas.js
 *   (must have persona_id, hourly_rate, and tasks array)
 * @param {number} implementationCost — total one-time cost for deploying
 *   all agents for this persona
 * @returns {object} same shape as calculateROI return value
 */
function calculatePersonaROI(persona, implementationCost) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('calculatePersonaROI: `persona` must be an object');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('calculatePersonaROI: `persona.tasks` must be an array');
  }

  const totalHoursSaved = persona.tasks.reduce((sum, t) => {
    return sum + ((t.current_hours_weekly || 0) - (t.projected_hours_weekly || 0));
  }, 0);

  return calculateROI(persona.persona_id, totalHoursSaved, implementationCost);
}

/**
 * Dollar conversion: convert time savings and hourly rate into annual
 * monetary savings. This is the canonical "hours → dollars → annual" function
 * used across the wizard (KPI dashboard, agent config, completion screen) so
 * the formula is never duplicated.
 *
 * Formula:
 *   annualSavings = hoursSavedWeekly × hourlyRate × 52
 *
 * Returns an integer (Math.round) for clean UI display. Callers that need
 * the raw unrounded value can import WEEKS_PER_YEAR and multiply directly.
 *
 * @param {number} hoursSavedWeekly — weekly hours saved by the agent (must be ≥ 0)
 * @param {number} hourlyRate — role-specific hourly rate in USD (must be ≥ 0)
 * @returns {number} annual dollar savings, rounded to the nearest whole dollar
 * @throws {Error} if either argument is non-finite or negative
 */
function computeAnnualDollarSavings(hoursSavedWeekly, hourlyRate) {
  if (typeof hoursSavedWeekly !== 'number' || !Number.isFinite(hoursSavedWeekly)) {
    throw new Error(
      'computeAnnualDollarSavings: `hoursSavedWeekly` must be a finite number'
    );
  }
  if (hoursSavedWeekly < 0) {
    throw new Error(
      'computeAnnualDollarSavings: `hoursSavedWeekly` must be ≥ 0'
    );
  }
  if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate)) {
    throw new Error(
      'computeAnnualDollarSavings: `hourlyRate` must be a finite number'
    );
  }
  if (hourlyRate < 0) {
    throw new Error(
      'computeAnnualDollarSavings: `hourlyRate` must be ≥ 0'
    );
  }
  return Math.round(hoursSavedWeekly * hourlyRate * WEEKS_PER_YEAR);
}

/**
 * Convert a list of tasks and a role-specific hourly rate into a dollar ROI
 * value representing the weekly, monthly, and annual savings that accrue when
 * the projected (AI-assisted) hours replace the current hours for every task.
 *
 * This is the canonical "tasks + rate → dollars" function specified by the
 * AgentStart wizard contract. It is intentionally minimal: it does not take
 * an implementation cost, because the upstream UX presents gross savings as
 * the headline ROI figure. (Net-of-cost ROI is handled by `calculateROI` /
 * `calculatePersonaROI`.)
 *
 * Formula:
 *   hoursSavedWeekly = Σ (current_hours_weekly − projected_hours_weekly)
 *   weekly  = hoursSavedWeekly × hourlyRate
 *   monthly = weekly × 4.33
 *   annual  = weekly × 52
 *
 * Each dollar figure is rounded to the nearest whole dollar for clean UI
 * display. The function also returns the aggregate `hoursSavedWeekly` and
 * `timeSavedPct` so callers can render a single ROI summary without re-doing
 * the math themselves.
 *
 * Validation rules:
 *   - `tasks` must be an array. An empty array returns all-zero figures.
 *   - `hourlyRate` must be a finite number ≥ 0.
 *   - Each task is validated by `calculateTimeSaved` (current/projected hours
 *     must be finite, non-negative, and projected ≤ current).
 *
 * @param {Array<object>} tasks — task objects with `current_hours_weekly`
 *   and `projected_hours_weekly` numeric fields
 * @param {number} hourlyRate — role-specific hourly rate in USD
 * @returns {{
 *   hoursSavedWeekly: number,
 *   hourlyRate: number,
 *   timeSavedPct: number,
 *   roiWeekly: number,
 *   roiMonthly: number,
 *   roiAnnual: number,
 * }}
 * @throws {Error} if `tasks` is not an array, `hourlyRate` is invalid, or
 *   any task fails the `calculateTimeSaved` validation rules
 */
function calculateROIFromTasks(tasks, hourlyRate) {
  if (!Array.isArray(tasks)) {
    throw new Error('calculateROIFromTasks: `tasks` must be an array');
  }
  if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate)) {
    throw new Error(
      'calculateROIFromTasks: `hourlyRate` must be a finite number'
    );
  }
  if (hourlyRate < 0) {
    throw new Error('calculateROIFromTasks: `hourlyRate` must be ≥ 0');
  }

  // Aggregate hours via the canonical time-savings function so the math is
  // consistent with the KPI dashboard.
  const timeSavedPct = calculateTimeSaved(tasks);

  let hoursSavedWeekly = 0;
  for (const task of tasks) {
    const current =
      task.current_hours_weekly === undefined ||
      task.current_hours_weekly === null
        ? 0
        : task.current_hours_weekly;
    const projected =
      task.projected_hours_weekly === undefined ||
      task.projected_hours_weekly === null
        ? 0
        : task.projected_hours_weekly;
    hoursSavedWeekly += current - projected;
  }

  const roiWeekly = Math.round(hoursSavedWeekly * hourlyRate);
  const roiMonthly = Math.round(roiWeekly * WEEKS_PER_MONTH);
  const roiAnnual = roiWeekly * WEEKS_PER_YEAR;

  return {
    hoursSavedWeekly,
    hourlyRate,
    timeSavedPct,
    roiWeekly,
    roiMonthly,
    roiAnnual,
  };
}

/**
 * Compute per-task dollar-savings metrics from hours saved and an hourly rate.
 *
 * This is the canonical per-task "hours saved → dollars" conversion used by
 * the persona data builder (personas.js) and the KPI dashboard (kpi.js) so
 * that every downstream consumer derives the same figures from the same
 * formula. It intentionally does NOT take an implementation cost — it
 * computes gross savings only (the headline display figure).
 *
 * Formula:
 *   roiWeekly  = round(hoursSavedWeekly × hourlyRate)
 *   roiMonthly = round(roiWeekly × WEEKS_PER_MONTH)
 *   roiAnnual  = roiWeekly × WEEKS_PER_YEAR
 *
 * Note: roiAnnual is NOT independently rounded — it is derived from the
 * already-rounded weekly value so that the invariant `annual = weekly × 52`
 * always holds for display consistency.
 *
 * @param {number} hoursSavedWeekly — weekly hours saved (must be ≥ 0, finite)
 * @param {number} hourlyRate — role-specific hourly rate in USD (must be ≥ 0, finite)
 * @returns {{ roiWeekly: number, roiMonthly: number, roiAnnual: number }}
 * @throws {Error} if either argument is non-finite or negative
 */
function computeTaskROIMetrics(hoursSavedWeekly, hourlyRate) {
  if (typeof hoursSavedWeekly !== 'number' || !Number.isFinite(hoursSavedWeekly)) {
    throw new Error(
      'computeTaskROIMetrics: `hoursSavedWeekly` must be a finite number'
    );
  }
  if (hoursSavedWeekly < 0) {
    throw new Error(
      'computeTaskROIMetrics: `hoursSavedWeekly` must be ≥ 0'
    );
  }
  if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate)) {
    throw new Error(
      'computeTaskROIMetrics: `hourlyRate` must be a finite number'
    );
  }
  if (hourlyRate < 0) {
    throw new Error(
      'computeTaskROIMetrics: `hourlyRate` must be ≥ 0'
    );
  }

  const roiWeekly = Math.round(hoursSavedWeekly * hourlyRate);
  const roiMonthly = Math.round(roiWeekly * WEEKS_PER_MONTH);
  const roiAnnual = roiWeekly * WEEKS_PER_YEAR;

  return { roiWeekly, roiMonthly, roiAnnual };
}

module.exports = {
  calculateROI,
  calculateROIFromTasks,
  calculateTaskROI,
  calculatePersonaROI,
  computeAnnualDollarSavings,
  computeTaskROIMetrics,
  WEEKS_PER_MONTH,
  WEEKS_PER_YEAR,
};
