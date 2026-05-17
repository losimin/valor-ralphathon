// AgentStart — agent toggle default policy.
//
// Step 4 of the wizard renders an "enable agent" toggle for every task
// that has an associated agent. Per the Seed contract, an agent's
// toggle defaults to ON when the `automation_confidence` score is at
// or above the 80% threshold, and OFF otherwise.
//
// This module exposes a single pure function so the threshold lives in
// exactly one place. Both the UI (`Step4Configure`) and the data layer
// (`agent_enabled` derivation) read from it.

const AGENT_AUTO_ENABLE_THRESHOLD = 80;

/**
 * Decide whether an agent's toggle should default to ON.
 *
 * @param {number} confidence - automation_confidence, scored 0–100.
 * @returns {boolean} true when confidence >= 80, false otherwise.
 * @throws {TypeError} when confidence is not a finite number.
 * @throws {RangeError} when confidence is outside [0, 100].
 */
function isAgentEnabledByDefault(confidence) {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    throw new TypeError(
      'isAgentEnabledByDefault: `confidence` must be a finite number'
    );
  }
  if (confidence < 0 || confidence > 100) {
    throw new RangeError(
      'isAgentEnabledByDefault: `confidence` must be within [0, 100]'
    );
  }
  return confidence >= AGENT_AUTO_ENABLE_THRESHOLD;
}

module.exports = {
  AGENT_AUTO_ENABLE_THRESHOLD,
  isAgentEnabledByDefault,
};
