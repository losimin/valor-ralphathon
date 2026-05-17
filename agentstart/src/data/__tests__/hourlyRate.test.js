// Sub-AC 7.1: Define a data module containing role-specific market average
// hourly rates with cited sources for all five personas.
//
// Tests cover:
//   1. Every persona has a distinct, plausible hourly rate within BLS OEWS bounds.
//   2. Each rate entry carries a full citation (BLS, OEWS, SOC code, mean wage).
//   3. Lookup helpers return correct values and throw on unknown IDs.
//   4. The coverage validator works correctly.
//   5. (Integration) Every task's roi_weekly / roi_monthly in personas.js
//      matches the hourly rate from the hourlyRates module.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hourlyRates,
  getHourlyRate,
  getRateEntry,
  lookupRate,
  getAllRateEntries,
  getAllRateEntriesList,
  getRateMap,
  validateCoverage,
  VALID_PERSONA_IDS,
} = require('../hourlyRates');

const { personas } = require('../personas');

// ── Rate bounds (BLS OEWS May 2023 sanity ranges) ──────────────────────
const RATE_BOUNDS = {
  editor:             [25, 50],
  financial_advisor:  [50, 90],
  teacher:            [25, 45],
  project_manager:    [45, 75],
  customer_service_rep: [15, 30],
};

const REQUIRED_PERSONA_IDS = [
  'editor',
  'financial_advisor',
  'teacher',
  'project_manager',
  'customer_service_rep',
];

// ── Data-module structure tests ─────────────────────────────────────────

test('hourlyRates map contains exactly the five required personas', () => {
  const ids = Object.keys(hourlyRates).sort();
  assert.deepEqual(ids, REQUIRED_PERSONA_IDS.sort());
});

test('each rate entry has all required fields', () => {
  const requiredFields = [
    'persona_id',
    'persona_name',
    'hourly_rate',
    'mean_annual_wage',
    'occupation_title',
    'soc_code',
    'source_detail',
  ];
  for (const [id, entry] of Object.entries(hourlyRates)) {
    for (const field of requiredFields) {
      assert.ok(
        entry[field] !== undefined && entry[field] !== null,
        `${id} missing required field "${field}"`
      );
    }
  }
});

test('every persona has a role-specific hourly rate within BLS OEWS bounds', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const bounds = RATE_BOUNDS[personaId];
    assert.ok(bounds, `no rate bounds registered for ${personaId}`);
    const rate = hourlyRates[personaId].hourly_rate;
    const [lo, hi] = bounds;
    assert.ok(
      rate >= lo && rate <= hi,
      `${hourlyRates[personaId].persona_name} hourly_rate=${rate} outside [${lo}, ${hi}]`
    );
  }
});

test('hourly rates are distinct across the five personas', () => {
  const rates = Object.values(hourlyRates).map((e) => e.hourly_rate);
  const unique = new Set(rates);
  assert.equal(
    unique.size,
    rates.length,
    `expected distinct hourly rates per role, got ${rates.join(', ')}`
  );
});

// ── Citation quality tests ──────────────────────────────────────────────

test('every source_detail cites BLS and OEWS', () => {
  for (const [id, entry] of Object.entries(hourlyRates)) {
    const src = entry.source_detail;
    assert.match(
      src,
      /Bureau of Labor Statistics|BLS/i,
      `${entry.persona_name} source_detail must reference BLS`
    );
    assert.match(
      src,
      /OEWS|Occupational Employment/i,
      `${entry.persona_name} source_detail must reference OEWS`
    );
  }
});

test('every entry includes a valid SOC occupation code', () => {
  const SOC_PATTERN = /SOC\s*\d{2}-\d{4}/;
  for (const [id, entry] of Object.entries(hourlyRates)) {
    assert.match(
      entry.source_detail,
      SOC_PATTERN,
      `${entry.persona_name} source_detail must include SOC code`
    );
    assert.match(
      entry.soc_code,
      /^\d{2}-\d{4}$/,
      `${entry.persona_name} soc_code must be XX-XXXX format, got "${entry.soc_code}"`
    );
  }
});

test('mean_annual_wage is consistent with hourly_rate (± $2/hr tolerance)', () => {
  // hourly ≈ mean_annual / 2080
  for (const [id, entry] of Object.entries(hourlyRates)) {
    const impliedHourly = entry.mean_annual_wage / 2080;
    const diff = Math.abs(impliedHourly - entry.hourly_rate);
    assert.ok(
      diff <= 2,
      `${entry.persona_name}: hourly_rate=${entry.hourly_rate} diverges from ` +
        `mean_annual_wage=${entry.mean_annual_wage} / 2080 = ${impliedHourly.toFixed(2)} ` +
        `by ${diff.toFixed(2)} (> 2)`
    );
  }
});

// ── Lookup helper tests ─────────────────────────────────────────────────

test('getHourlyRate() returns the correct rate for every persona', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const rateFromHelper = getHourlyRate(personaId);
    const rateFromMap = hourlyRates[personaId].hourly_rate;
    assert.equal(
      rateFromHelper,
      rateFromMap,
      `getHourlyRate("${personaId}") returned ${rateFromHelper}, expected ${rateFromMap}`
    );
  }
});

test('getHourlyRate() throws on unknown persona ID', () => {
  assert.throws(
    () => getHourlyRate('nonsense'),
    /Unknown persona ID/,
    'expected error for unknown persona ID'
  );
});

test('getRateEntry() returns a full entry with all fields', () => {
  const entry = getRateEntry('editor');
  assert.equal(entry.persona_id, 'editor');
  assert.equal(entry.persona_name, 'Editor');
  assert.equal(entry.hourly_rate, 36);
  assert.equal(entry.soc_code, '27-3041');
  assert.ok(typeof entry.source_detail === 'string');
});

test('getRateEntry() throws on unknown persona ID', () => {
  assert.throws(
    () => getRateEntry('unknown'),
    /Unknown persona ID/,
    'expected error for unknown persona ID'
  );
});

// ── lookupRate tests (Sub-AC 7.2) ───────────────────────────────────────

test('lookupRate() returns hourly_rate and rate_source for every valid persona', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const result = lookupRate(personaId);
    const entry = hourlyRates[personaId];

    // Must have exactly the two expected keys
    const keys = Object.keys(result).sort();
    assert.deepEqual(keys, ['hourly_rate', 'rate_source']);

    // Values must match the source data
    assert.equal(
      result.hourly_rate,
      entry.hourly_rate,
      `lookupRate("${personaId}").hourly_rate mismatch`
    );
    assert.equal(
      result.rate_source,
      entry.source_detail,
      `lookupRate("${personaId}").rate_source should match source_detail`
    );
  }
});

test('lookupRate() rate_source contains the full BLS citation text', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const { rate_source } = lookupRate(personaId);
    // Must cite BLS and OEWS
    assert.match(rate_source, /Bureau of Labor Statistics|BLS/i);
    assert.match(rate_source, /OEWS|Occupational Employment/i);
    // Must include SOC code
    assert.match(rate_source, /SOC\s*\d{2}-\d{4}/);
    // Must not be empty
    assert.ok(rate_source.length > 50, 'rate_source citation is too short');
  }
});

test('lookupRate() throws on unknown persona ID with helpful message', () => {
  assert.throws(
    () => lookupRate('astronaut'),
    /Unknown persona ID/,
    'expected error for unknown persona ID'
  );
  // Verify the error message includes the valid IDs list
  assert.throws(
    () => lookupRate('pilot'),
    (err) => {
      if (!/Unknown persona ID/.test(err.message)) return false;
      // Message should include valid IDs guidance
      return (
        err.message.includes('Valid IDs are:') ||
        err.message.includes('editor')
      );
    },
    'error message should list valid persona IDs'
  );
});

test('lookupRate() hourly_rate is a positive number for all personas', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const { hourly_rate } = lookupRate(personaId);
    assert.equal(typeof hourly_rate, 'number');
    assert.ok(hourly_rate > 0, `${personaId} hourly_rate must be positive`);
  }
});

test('lookupRate() is consistent with getHourlyRate and getRateEntry', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const looked = lookupRate(personaId);
    const rateOnly = getHourlyRate(personaId);
    const fullEntry = getRateEntry(personaId);

    assert.equal(looked.hourly_rate, rateOnly);
    assert.equal(looked.rate_source, fullEntry.source_detail);
  }
});

test('getAllRateEntries() returns a fresh copy with all five entries', () => {
  const all = getAllRateEntries();
  const ids = Object.keys(all).sort();
  assert.deepEqual(ids, REQUIRED_PERSONA_IDS.sort());
  // should not be the same object reference
  assert.notEqual(all, hourlyRates);
});

test('getAllRateEntriesList() returns a 5-element array sorted by name', () => {
  const list = getAllRateEntriesList();
  assert.equal(list.length, 5);
  const names = list.map((e) => e.persona_name);
  assert.deepEqual(names, [...names].sort(), 'entries should be sorted by persona_name');
});

test('getRateMap() returns persona_id → hourly_rate for all five', () => {
  const map = getRateMap();
  assert.equal(Object.keys(map).length, 5);
  for (const personaId of REQUIRED_PERSONA_IDS) {
    assert.equal(map[personaId], hourlyRates[personaId].hourly_rate);
  }
});

// ── Coverage validator tests ────────────────────────────────────────────

test('validateCoverage passes when all required IDs are present', () => {
  const result = validateCoverage(REQUIRED_PERSONA_IDS);
  assert.equal(result.valid, true);
  assert.equal(result.missing.length, 0);
});

test('validateCoverage reports missing persona IDs', () => {
  const result = validateCoverage([
    ...REQUIRED_PERSONA_IDS,
    'nonexistent_role',
  ]);
  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, ['nonexistent_role']);
});

// ── Integration: persona tasks use the hourlyRates module ──────────────

test('every persona in personas.js has its rate from hourlyRates.js', () => {
  for (const persona of personas) {
    const expectedRate = getHourlyRate(persona.persona_id);
    assert.equal(
      persona.hourly_rate,
      expectedRate,
      `${persona.persona_name}: personas hourly_rate=${persona.hourly_rate} ` +
        `mismatches hourlyRates rate=${expectedRate}`
    );
  }
});

test('roi_weekly equals hourly_rate * weekly hours saved for every task', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      const hoursSaved =
        task.current_hours_weekly - task.projected_hours_weekly;
      const expected = Math.round(hoursSaved * persona.hourly_rate);
      assert.equal(
        task.roi_weekly,
        expected,
        `${persona.persona_name} / ${task.task_name}: roi_weekly=${task.roi_weekly} ` +
          `does not match ${persona.hourly_rate}/hr * ${hoursSaved}h = ${expected}`
      );
    }
  }
});

test('roi_monthly is roi_weekly scaled by ~4.33 weeks/month', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      const expected = Math.round(task.roi_weekly * 4.33);
      assert.equal(
        task.roi_monthly,
        expected,
        `${persona.persona_name} / ${task.task_name}: roi_monthly=${task.roi_monthly} ` +
          `does not match ${task.roi_weekly} * 4.33 = ${expected}`
      );
    }
  }
});
