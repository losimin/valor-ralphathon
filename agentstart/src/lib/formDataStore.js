// AgentStart — form data store module.
//
// Provides a lightweight in-memory key-value store for persisting per-step
// wizard form state within a persona session. Step components call `save`
// with their local state (toggle positions, task selections, etc.) so that
// the data survives back/forward navigation. The wizard controller calls
// `clear` when the user switches personas or restarts the flow.
//
// Lifecycle:
//   1. AgentStartApp creates a single store on initialisation.
//   2. Each step component saves its form state on every change
//      (e.g., toggle flip, task click).
//   3. On persona switch or wizard restart, the store is cleared for the
//      outgoing persona so stale data never leaks across sessions.
//
// Design notes:
//   - In-memory only — no filesystem or localStorage dependency. This keeps
//     the prototype self-contained and testable without DOM APIs.
//   - Persona-scoped — data is keyed by (personaId, stepIndex) so form state
//     from one persona never collides with another.
//   - Last-write-wins — saving to the same (personaId, stepIndex) overwrites;
//     there is no append/merge mode.

/**
 * Create a new form data store.
 *
 * Returns an object with four methods: save, retrieve, clear, and has.
 * The store is purely synchronous and all operations are O(1).
 *
 * @returns {{
 *   save: (personaId: string, stepIndex: number, data: object) => void,
 *   retrieve: (personaId: string, stepIndex?: number) => object | undefined,
 *   clear: (personaId?: string) => void,
 *   has: (personaId: string, stepIndex: number) => boolean,
 * }}
 */
function createFormDataStore() {
  // Internal: Map<personaId, Map<stepIndex, data>>
  const store = new Map();

  // ── Validation helpers ──────────────────────────────────────────────────

  function requireNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(
        `FormDataStore.${label}: personaId must be a non-empty string`
      );
    }
  }

  function requireValidStepIndex(value, label) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
      throw new TypeError(
        `FormDataStore.${label}: stepIndex must be an integer between 1 and 5`
      );
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Save form data for a persona at a specific wizard step.
   *
   * The data object is stored by reference — callers that mutate it after
   * saving will see those mutations reflected on retrieval. Clone the object
   * before saving if immutability is needed.
   *
   * @param {string} personaId — e.g., "editor", "financial_advisor"
   * @param {number} stepIndex — 1-based step index (1…5)
   * @param {object} data — arbitrary serialisable form state
   * @throws {TypeError} on invalid personaId or stepIndex
   */
  function save(personaId, stepIndex, data) {
    requireNonEmptyString(personaId, 'save');
    requireValidStepIndex(stepIndex, 'save');

    if (!store.has(personaId)) {
      store.set(personaId, new Map());
    }
    store.get(personaId).set(stepIndex, data);
  }

  /**
   * Retrieve saved form data.
   *
   * When called with only a personaId, returns a plain object mapping
   * stepIndex → data for every step that has saved state. Returns an empty
   * object when nothing has been saved for that persona.
   *
   * When called with both personaId and stepIndex, returns the data for that
   * specific step, or `undefined` if nothing has been saved.
   *
   * @param {string} personaId
   * @param {number} [stepIndex] — optional; if omitted, returns all step data
   * @returns {object|undefined} the saved data, or undefined
   * @throws {TypeError} on invalid personaId or stepIndex
   */
  function retrieve(personaId, stepIndex) {
    requireNonEmptyString(personaId, 'retrieve');

    // Validate stepIndex early — before checking whether the persona has
    // saved data — so that invalid stepIndex values are always rejected
    // regardless of store state.
    if (arguments.length >= 2) {
      requireValidStepIndex(stepIndex, 'retrieve');
    }

    const personaStore = store.get(personaId);
    if (!personaStore) {
      // No data for this persona — return undefined for single-step lookup
      // or empty object for full retrieval.
      return arguments.length >= 2 ? undefined : {};
    }

    if (arguments.length >= 2) {
      return personaStore.get(stepIndex);
    }

    // Return all per-step data as a plain object.
    const result = {};
    for (const [step, data] of personaStore) {
      result[step] = data;
    }
    return result;
  }

  /**
   * Clear stored form data.
   *
   * When called with a personaId, removes all data for that persona only.
   * When called without arguments, removes all data for all personas.
   *
   * Idempotent: safe to call on an empty store or with a personaId that
   * has no saved data.
   *
   * @param {string} [personaId] — optional; if omitted, clears everything
   * @throws {TypeError} if personaId is provided but is not a non-empty string
   */
  function clear(personaId) {
    if (arguments.length === 0) {
      store.clear();
      return;
    }
    requireNonEmptyString(personaId, 'clear');
    store.delete(personaId);
  }

  /**
   * Check whether data has been saved for a given persona/step combination.
   *
   * @param {string} personaId
   * @param {number} stepIndex — 1-based step index (1…5)
   * @returns {boolean} true if data exists for that persona and step
   * @throws {TypeError} on invalid personaId or stepIndex
   */
  function has(personaId, stepIndex) {
    requireNonEmptyString(personaId, 'has');
    requireValidStepIndex(stepIndex, 'has');

    const personaStore = store.get(personaId);
    if (!personaStore) return false;
    return personaStore.has(stepIndex);
  }

  return { save, retrieve, clear, has };
}

module.exports = { createFormDataStore };
