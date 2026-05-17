// AgentStart — 95% confidence interval module for task time estimates.
//
// Each task in `src/data/personas.js` carries a `time_saved_pct` point
// estimate plus `confidence_interval_low` / `confidence_interval_high`
// bounds expressed as whole-percent time-saved values (anchored to
// Eloundou et al. 2023, arXiv:2303.10130, and Anthropic Economic Index
// reports). Step 2 of the wizard needs those bounds converted into
// concrete weekly-hours-saved and remaining-projected-hours ranges so
// the dashboard can show "you could save between X and Y hours/week".
//
// This module centralizes that conversion so the UI never re-derives it
// inline. All hour values are returned to one decimal place to match the
// fidelity of the underlying hardcoded hours; percent bounds are passed
// through as whole numbers.
//
// It also provides `computeConfidenceIntervals`, which derives the 95% CI
// bounds from raw frequency-sample data (arrays of observed time-savings
// percentages) — the statistical engine that can be used to generate or
// validate the hardcoded CI values.
//
// Conventions
//   - A "% saved" of 70 against 10 current hours/week means 7 hours
//     saved/week and 3 projected remaining hours/week.
//   - lower/upper bounds always refer to the 95% CI on time saved
//     (so lowerHoursSaved <= upperHoursSaved, and
//      lowerProjectedHours >= upperProjectedHours).

const CI_LEVEL = 0.95;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function round1(n) {
  return Math.round(n * 10) / 10;
}

function ensureTaskShape(task) {
  if (!task || typeof task !== 'object') {
    throw new Error('confidenceInterval: `task` must be an object');
  }
  const required = [
    'current_hours_weekly',
    'confidence_interval_low',
    'confidence_interval_high',
  ];
  for (const key of required) {
    if (typeof task[key] !== 'number') {
      throw new Error(
        `confidenceInterval: \`task.${key}\` must be a number`
      );
    }
  }
  if (task.confidence_interval_low > task.confidence_interval_high) {
    throw new Error(
      'confidenceInterval: `confidence_interval_low` must be <= `confidence_interval_high`'
    );
  }
}

/**
 * Student's t-distribution 95% two-tailed critical values for df 1–30.
 * For df > 30 the normal approximation (z = 1.96) is used.
 *
 * Source: standard statistical tables; cross-checked against scipy.stats.t.ppf(0.975, df).
 */
const T_CRITICAL = Object.freeze({
   1: 12.706,  2: 4.303,  3: 3.182,  4: 2.776,  5: 2.571,
   6:  2.447,  7: 2.365,  8: 2.306,  9: 2.262, 10: 2.228,
  11:  2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  16:  2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  21:  2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
  26:  2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
});

const Z_CRITICAL = 1.96; // normal approximation for n > 30

/**
 * Return the appropriate 95% CI critical value for a given sample size.
 * Uses t-distribution (df = n − 1) for df ≤ 30, normal z = 1.96 for df > 30.
 */
function criticalValue(sampleSize) {
  const df = sampleSize - 1;
  if (df >= 1 && df <= 30 && T_CRITICAL[df] !== undefined) {
    return T_CRITICAL[df];
  }
  return Z_CRITICAL;
}

// ---------------------------------------------------------------------------
// Public: CI derivation from frequency-sample data
// ---------------------------------------------------------------------------

/**
 * Validate that frequency sample data is usable for CI computation.
 * @throws {Error} if samples is not an array, has fewer than 2 entries,
 *   or contains non-finite values.
 */
function validateSamples(samples, taskName) {
  if (!Array.isArray(samples)) {
    throw new Error(
      `computeConfidenceIntervals: frequencySamples["${taskName}"] must be an array`
    );
  }
  if (samples.length < 2) {
    throw new Error(
      `computeConfidenceIntervals: frequencySamples["${taskName}"] ` +
      `must contain at least 2 observations (got ${samples.length})`
    );
  }
  for (let i = 0; i < samples.length; i++) {
    if (typeof samples[i] !== 'number' || !Number.isFinite(samples[i])) {
      throw new Error(
        `computeConfidenceIntervals: frequencySamples["${taskName}"][${i}] ` +
        `must be a finite number (got ${samples[i]})`
      );
    }
  }
}

/**
 * Compute the 95% confidence interval [low, high] from an array of sample
 * observations.
 *
 * Uses the sample mean, sample standard deviation (Bessel-corrected, n−1),
 * and the appropriate critical value (t for n ≤ 30, z = 1.96 for n > 30).
 * Results are clamped to [0, 100] and rounded to whole integers to match
 * the ontology's whole-percent CI fields.
 *
 * @param {number[]} samples — array of observed time-savings percentages
 * @returns {{ low: number, high: number }}
 */
function ciFromSamples(samples) {
  const n = samples.length;

  // Sample mean
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += samples[i];
  }
  const mean = sum / n;

  // Sample standard deviation (Bessel-corrected)
  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    const diff = samples[i] - mean;
    sumSqDiff += diff * diff;
  }
  const stdDev = n > 1 ? Math.sqrt(sumSqDiff / (n - 1)) : 0;

  // Standard error and margin
  const stdErr = stdDev / Math.sqrt(n);
  const crit = criticalValue(n);
  const margin = crit * stdErr;

  const rawLow = mean - margin;
  const rawHigh = mean + margin;

  // Clamp to [0, 100] and round to whole integers
  const low = Math.max(0, Math.round(rawLow));
  const high = Math.min(100, Math.round(rawHigh));

  return { low, high };
}

/**
 * Compute 95% confidence interval ranges for each task from frequency
 * sample data, returning a new array of tasks with added
 * `confidence_interval_low` and `confidence_interval_high` fields.
 *
 * Each task in `tasks` must have a `task_name` field; the corresponding
 * key in `frequencySamples` must map to a non-empty array of numeric
 * time-savings-percentage observations (pilot studies, field trials, or
 * literature estimates).
 *
 * Statistical method:
 *   - Sample mean and Bessel-corrected sample standard deviation
 *   - Student's t critical value for n ≤ 30 (lookup table)
 *   - Normal z = 1.96 for n > 30
 *   - CI clamped to [0, 100] and rounded to whole integers
 *
 * References:
 *   - Eloundou et al. (2023), arXiv:2303.10130
 *   - Anthropic Economic Index (2024–2025)
 *
 * @param {Array<{task_name: string}>} tasks — task objects (at minimum
 *   each must have a string `task_name` property)
 * @param {Object<string, number[]>} frequencySamples — map of task_name
 *   to an array of observed time-savings percentages
 * @returns {Array} shallow copy of `tasks` with `confidence_interval_low`
 *   and `confidence_interval_high` added to each entry
 * @throws {Error} if any task is missing sample data, if sample arrays
 *   have fewer than 2 observations, or if samples contain non-finite values
 */
function computeConfidenceIntervals(tasks, frequencySamples) {
  if (!Array.isArray(tasks)) {
    throw new Error('computeConfidenceIntervals: `tasks` must be an array');
  }
  if (!frequencySamples || typeof frequencySamples !== 'object') {
    throw new Error(
      'computeConfidenceIntervals: `frequencySamples` must be an object'
    );
  }

  return tasks.map((task, idx) => {
    if (!task || typeof task !== 'object') {
      throw new Error(
        `computeConfidenceIntervals: tasks[${idx}] must be an object`
      );
    }
    if (typeof task.task_name !== 'string' || !task.task_name) {
      throw new Error(
        `computeConfidenceIntervals: tasks[${idx}].task_name must be a non-empty string`
      );
    }

    const samples = frequencySamples[task.task_name];
    if (!samples) {
      throw new Error(
        `computeConfidenceIntervals: no frequency sample data for task "${task.task_name}"`
      );
    }
    validateSamples(samples, task.task_name);

    const { low, high } = ciFromSamples(samples);

    // Always produce a valid interval; swap if rounding/clamping inverted order
    return {
      ...task,
      confidence_interval_low: Math.min(low, high),
      confidence_interval_high: Math.max(low, high),
    };
  });
}

// ---------------------------------------------------------------------------
// Public: CI conversion for rendering (existing)
// ---------------------------------------------------------------------------

/**
 * Compute the 95% confidence interval for a single task's time-saved
 * estimate, in three coordinate systems:
 *   - lowerPct / upperPct           (whole-percent time saved)
 *   - lowerHoursSaved / upperHoursSaved      (hours/week saved)
 *   - lowerProjectedHours / upperProjectedHours (hours/week remaining)
 *
 * Inputs come straight from a persona task object.
 */
function computeTaskTimeCi(task) {
  ensureTaskShape(task);
  const cur = task.current_hours_weekly;
  const lowPct = task.confidence_interval_low;
  const highPct = task.confidence_interval_high;

  const lowerHoursSaved = round1((lowPct / 100) * cur);
  const upperHoursSaved = round1((highPct / 100) * cur);
  const lowerProjectedHours = round1(cur - upperHoursSaved);
  const upperProjectedHours = round1(cur - lowerHoursSaved);

  return {
    ciLevel: CI_LEVEL,
    lowerPct: lowPct,
    upperPct: highPct,
    lowerHoursSaved,
    upperHoursSaved,
    lowerProjectedHours,
    upperProjectedHours,
  };
}

/**
 * Compute the 95% confidence interval range for a single task's estimated
 * time savings, returned as `{ lower, upper }`.
 *
 * This is the canonical Sub-AC entry point for the CI module: given a
 * persona task (with `current_hours_weekly`, `confidence_interval_low`,
 * and `confidence_interval_high` percent bounds), it returns the absolute
 * lower and upper weekly-hours-saved estimate at 95% confidence.
 *
 * Hours are rounded to one decimal place. The companion percent bounds and
 * remaining-projected-hours range are also exposed so callers that need the
 * other coordinate systems don't have to re-derive them.
 *
 * Example:
 *   computeConfidenceInterval({
 *     current_hours_weekly: 10,
 *     confidence_interval_low: 60,
 *     confidence_interval_high: 80,
 *   })
 *   // → { lower: 6, upper: 8, lowerPct: 60, upperPct: 80,
 *   //     lowerProjectedHours: 2, upperProjectedHours: 4, ciLevel: 0.95 }
 *
 * @param {Object} task — persona task object (see ontology)
 * @returns {{ lower: number, upper: number,
 *             lowerPct: number, upperPct: number,
 *             lowerProjectedHours: number, upperProjectedHours: number,
 *             ciLevel: number }}
 */
function computeConfidenceInterval(task) {
  const ci = computeTaskTimeCi(task);
  return {
    lower: ci.lowerHoursSaved,
    upper: ci.upperHoursSaved,
    lowerPct: ci.lowerPct,
    upperPct: ci.upperPct,
    lowerProjectedHours: ci.lowerProjectedHours,
    upperProjectedHours: ci.upperProjectedHours,
    ciLevel: ci.ciLevel,
  };
}

module.exports = {
  CI_LEVEL,
  computeConfidenceInterval,
  computeTaskTimeCi,
  computeConfidenceIntervals,
  ciFromSamples,
};
