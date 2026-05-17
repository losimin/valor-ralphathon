// AgentStart — time-savings percentage computation module.
//
// Provides the canonical `computeTimeSavingsPct` function that takes original
// (current) and AI-assisted (projected) weekly-hour values from persona
// workflow data and returns the percentage reduction in time spent.
//
// This is the single source of truth for the time-saved percentage math used
// across the wizard: Step 2 (KPI dashboard), Step 3 (workflow cards), and
// Step 4 (agent config toggles). All callers that need the percentage from
// raw hours go through this function so the formula is never duplicated.
//
// Formula:
//   timeSavingsPct = ((originalHours - aiAssistedHours) / originalHours) × 100
//
// The function returns the raw (unrounded) numeric percentage. Callers that
// need a rounded whole-percent display value (e.g., the KPI dashboard)
// should apply Math.round themselves.
//
// Reference grounding:
//   - Eloundou et al. (2023), "GPTs are GPTs," arXiv:2303.10130.
//   - Anthropic Economic Index reports (2024–2025).

/**
 * Compute the percentage reduction in time spent when an AI agent assists
 * with a task.
 *
 * Accepts the original (pre-agent) and AI-assisted (post-agent) weekly hours
 * from a persona task and returns the time saved as a numeric percentage.
 *
 * Validation rules:
 *   - Both inputs must be finite numbers ≥ 0.
 *   - `aiAssistedHours` must not exceed `originalHours`
 *     (the agent cannot save more time than the task currently consumes).
 *   - When `originalHours` is 0 and `aiAssistedHours` is 0, returns 0
 *     (no time spent → no time to save).
 *   - When `originalHours` is 0 and `aiAssistedHours` > 0, throws
 *     (impossible to spend negative time).
 *
 * @param {number} originalHours  — current hours per week spent on the task
 * @param {number} aiAssistedHours — projected hours per week with AI agent
 * @returns {number} the raw (unrounded) percentage of time saved (0–100)
 * @throws {Error} if inputs are invalid (non-finite, negative, or
 *   `aiAssistedHours` exceeds `originalHours`)
 */
function computeTimeSavingsPct(originalHours, aiAssistedHours) {
  // --- Validate originalHours ------------------------------------------------
  if (typeof originalHours !== 'number' || !Number.isFinite(originalHours)) {
    throw new Error(
      'computeTimeSavingsPct: `originalHours` must be a finite number'
    );
  }
  if (originalHours < 0) {
    throw new Error(
      'computeTimeSavingsPct: `originalHours` must be ≥ 0'
    );
  }

  // --- Validate aiAssistedHours ----------------------------------------------
  if (typeof aiAssistedHours !== 'number' || !Number.isFinite(aiAssistedHours)) {
    throw new Error(
      'computeTimeSavingsPct: `aiAssistedHours` must be a finite number'
    );
  }
  if (aiAssistedHours < 0) {
    throw new Error(
      'computeTimeSavingsPct: `aiAssistedHours` must be ≥ 0'
    );
  }

  // --- Edge case: zero original hours ----------------------------------------
  if (originalHours === 0) {
    if (aiAssistedHours === 0) {
      // No time was spent, so there is nothing to save — 0%.
      return 0;
    }
    // Impossible: cannot spend negative time, yet aiAssistedHours > 0 while
    // originalHours is 0 would imply negative time saved.
    throw new Error(
      'computeTimeSavingsPct: `originalHours` is 0 but `aiAssistedHours` is ' +
      `${aiAssistedHours} — cannot compute savings when no time is spent`
    );
  }

  // --- Business rule: agent cannot create time -------------------------------
  if (aiAssistedHours > originalHours) {
    throw new Error(
      'computeTimeSavingsPct: `aiAssistedHours` (${aiAssistedHours}) ' +
      'cannot exceed `originalHours` (${originalHours})'
    );
  }

  // --- Core computation ------------------------------------------------------
  const hoursSaved = originalHours - aiAssistedHours;
  return (hoursSaved / originalHours) * 100;
}

/**
 * Convenience function: compute time-savings percentage directly from a
 * persona task object.
 *
 * Reads `current_hours_weekly` and `projected_hours_weekly` from the task
 * object and delegates to `computeTimeSavingsPct`.
 *
 * @param {object} task — a task object with current_hours_weekly and
 *   projected_hours_weekly numeric fields
 * @returns {number} the raw (unrounded) percentage of time saved (0–100)
 * @throws {Error} if the task object is missing or its fields are invalid
 */
function computeTaskTimeSavingsPct(task) {
  if (!task || typeof task !== 'object') {
    throw new Error('computeTaskTimeSavingsPct: `task` must be an object');
  }
  const original =
    typeof task.current_hours_weekly === 'number'
      ? task.current_hours_weekly
      : 0;
  const aiAssisted =
    typeof task.projected_hours_weekly === 'number'
      ? task.projected_hours_weekly
      : 0;
  return computeTimeSavingsPct(original, aiAssisted);
}

/**
 * Compute the aggregate percentage of time saved across a list of persona
 * tasks.
 *
 * Sums each task's current_hours_weekly and projected_hours_weekly across the
 * supplied array, then derives a single time-saved percentage from the
 * aggregate totals. This is the canonical formula used by the Step 2 KPI
 * dashboard headline number ("X% of weekly hours reclaimed") and matches
 * the persona-level `timeSavedPct` produced by `computePersonaKpis`.
 *
 * Formula:
 *   aggregatePct =
 *     ((Σ current_hours_weekly − Σ projected_hours_weekly) /
 *       Σ current_hours_weekly) × 100
 *
 * The returned value is the raw (unrounded) numeric percentage. Callers that
 * need a whole-percent display value should apply Math.round themselves.
 *
 * Validation rules:
 *   - `tasks` must be an array. An empty array returns 0 (nothing to save).
 *   - Each task must expose finite, non-negative numeric
 *     `current_hours_weekly` and `projected_hours_weekly` fields. Missing
 *     fields default to 0.
 *   - The aggregate projected hours must not exceed the aggregate current
 *     hours (an agent cannot create time across the workflow as a whole).
 *
 * @param {Array<object>} tasks — array of task objects with
 *   current_hours_weekly and projected_hours_weekly numeric fields
 * @returns {number} aggregate percentage of time saved (0–100, unrounded)
 * @throws {Error} if `tasks` is not an array, a task field is invalid, or
 *   the aggregate projected hours exceeds aggregate current hours
 */
function calculateTimeSaved(tasks) {
  if (!Array.isArray(tasks)) {
    throw new Error('calculateTimeSaved: `tasks` must be an array');
  }
  if (tasks.length === 0) {
    return 0;
  }

  let totalCurrent = 0;
  let totalProjected = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task || typeof task !== 'object') {
      throw new Error(
        `calculateTimeSaved: tasks[${i}] must be an object`
      );
    }

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

    if (typeof current !== 'number' || !Number.isFinite(current)) {
      throw new Error(
        `calculateTimeSaved: tasks[${i}].current_hours_weekly must be a finite number`
      );
    }
    if (typeof projected !== 'number' || !Number.isFinite(projected)) {
      throw new Error(
        `calculateTimeSaved: tasks[${i}].projected_hours_weekly must be a finite number`
      );
    }
    if (current < 0) {
      throw new Error(
        `calculateTimeSaved: tasks[${i}].current_hours_weekly must be ≥ 0`
      );
    }
    if (projected < 0) {
      throw new Error(
        `calculateTimeSaved: tasks[${i}].projected_hours_weekly must be ≥ 0`
      );
    }

    totalCurrent += current;
    totalProjected += projected;
  }

  if (totalCurrent === 0) {
    if (totalProjected === 0) return 0;
    throw new Error(
      'calculateTimeSaved: aggregate current_hours_weekly is 0 but ' +
        `aggregate projected_hours_weekly is ${totalProjected} — ` +
        'cannot compute savings when no time is spent'
    );
  }

  if (totalProjected > totalCurrent) {
    throw new Error(
      `calculateTimeSaved: aggregate projected_hours_weekly (${totalProjected}) ` +
        `cannot exceed aggregate current_hours_weekly (${totalCurrent})`
    );
  }

  return ((totalCurrent - totalProjected) / totalCurrent) * 100;
}

module.exports = {
  computeTimeSavingsPct,
  computeTaskTimeSavingsPct,
  calculateTimeSaved,
};
