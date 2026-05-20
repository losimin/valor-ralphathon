// AgentStart — task sorting module.
//
// Step 2 (the KPI / analysis dashboard) renders each persona's task list
// ordered by how frequently the persona performs that task, most-frequent
// first. The task breakdown table in Step 2, the workflow diagram in Step 3,
// and the agent config table in Step 4 can all share canonical sorting via
// the sortTasksByDimension function.
//
// sortTasksByDimension contract:
//   - Primary key:  the specified dimension (descending for numeric dimensions;
//                   ascending for task_name).
//   - Tie breaker:  task_name (ascending, locale-aware) so the output is
//                   deterministic when two tasks share the same primary value.
//   - Pure:         returns a new array; the input is not mutated.
//   - Tolerant:     tasks with a missing/non-numeric dimension value are
//                   treated as -Infinity (descending) or +Infinity (ascending)
//                   so they sort to the end rather than poisoning the
//                   comparator with NaN.
//
// Supported dimensions (all ontology numeric fields + task_name):
//   task_frequency, onet_frequency_score, time_saved_pct, current_hours_weekly,
//   projected_hours_weekly, roi_weekly, roi_monthly, roi_annual,
//   automation_confidence, confidence_interval_low, confidence_interval_high,
//   task_name
//
// The seed's ontology defines task_frequency as a "relative frequency
// ranking ... for ordering," which we interpret as: larger number =
// performed more often. That matches how the hardcoded persona data in
// `src/data/personas.js` assigns frequencies.

// Dimensions that sort ascending (smaller value first); everything else
// sorts descending (larger value first).
const ASCENDING_DIMENSIONS = new Set([
  'projected_hours_weekly',
  'task_name',
]);

// Dimensions that are valid sort keys.
const VALID_DIMENSIONS = new Set([
  'task_frequency',
  'onet_frequency_score',
  'time_saved_pct',
  'current_hours_weekly',
  'projected_hours_weekly',
  'roi_weekly',
  'roi_monthly',
  'roi_annual',
  'automation_confidence',
  'confidence_interval_low',
  'confidence_interval_high',
  'task_name',
]);

function nameOf(task) {
  return (task && typeof task.task_name === 'string') ? task.task_name : '';
}

function valueOf(task, dim) {
  if (dim === 'onet_frequency_score') {
    const onet = task && task.onet_frequency_score;
    if (typeof onet === 'number' && Number.isFinite(onet)) return onet;
    const fallback = task && task.task_frequency;
    return typeof fallback === 'number' && Number.isFinite(fallback)
      ? fallback
      : null;
  }
  const val = task && task[dim];
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

function freqOf(task) {
  const f = task && task.task_frequency;
  return typeof f === 'number' && Number.isFinite(f) ? f : -Infinity;
}

/**
 * Return a new array of tasks ordered by the specified dimension.
 * Ties broken by task_name ascending. Does not mutate the input.
 *
 * For numeric dimensions the default direction is descending (larger first),
 * except projected_hours_weekly which is ascending (less is better).
 * task_name sorts ascending (A–Z).
 *
 * @param {Array<object>} tasks
 * @param {string} dimension — a valid ontology field name
 * @returns {Array<object>}
 */
function sortTasksByDimension(tasks, dimension) {
  if (!Array.isArray(tasks)) {
    throw new Error('taskSort: `tasks` must be an array');
  }
  if (typeof dimension !== 'string' || !dimension) {
    throw new Error(
      'taskSort: `dimension` must be a non-empty string'
    );
  }
  if (!VALID_DIMENSIONS.has(dimension)) {
    throw new Error(
      `taskSort: unknown dimension "${dimension}". ` +
      `Valid dimensions are: ${[...VALID_DIMENSIONS].sort().join(', ')}.`
    );
  }

  const ascending = ASCENDING_DIMENSIONS.has(dimension);
  const sentinel = ascending ? Infinity : -Infinity;

  return tasks.slice().sort((a, b) => {
    // task_name is a string dimension — sort it directly via localeCompare.
    if (dimension === 'task_name') {
      return nameOf(a).localeCompare(nameOf(b));
    }

    // For ascending dimensions: smaller a → negative, so a - b.
    // For descending dimensions: larger a first → b - a.
    const va = valueOf(a, dimension);
    const vb = valueOf(b, dimension);
    const na = va !== null ? va : sentinel;
    const nb = vb !== null ? vb : sentinel;

    const diff = ascending ? (na - nb) : (nb - na);
    if (diff !== 0) return diff;
    return nameOf(a).localeCompare(nameOf(b));
  });
}

/**
 * Return a new array of tasks ordered by task_frequency descending.
 * Ties broken by task_name ascending. Does not mutate the input.
 *
 * Convenience wrapper around sortTasksByDimension.
 *
 * @param {Array<object>} tasks
 * @returns {Array<object>}
 */
function sortTasksByFrequency(tasks) {
  return sortTasksByDimension(tasks, 'task_frequency');
}

module.exports = {
  sortTasksByFrequency,
  sortTasksByDimension,
  VALID_DIMENSIONS,
};
