// Unit tests for the agent toggle default policy.
//
// The 80% threshold is load-bearing for the Seed: agents at or above
// it must default to enabled so the wizard demonstrates value without
// the user opting in. These tests pin the boundary at 79/80/81 and
// cover the natural edges (0, 100) plus input validation.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AGENT_AUTO_ENABLE_THRESHOLD,
  isAgentEnabledByDefault,
} = require('../agentToggleDefault');

test('threshold constant is 80', () => {
  assert.equal(AGENT_AUTO_ENABLE_THRESHOLD, 80);
});

test('confidence 79 is below threshold → OFF by default', () => {
  assert.equal(isAgentEnabledByDefault(79), false);
});

test('confidence 80 is exactly at threshold → ON by default', () => {
  assert.equal(isAgentEnabledByDefault(80), true);
});

test('confidence 81 is above threshold → ON by default', () => {
  assert.equal(isAgentEnabledByDefault(81), true);
});

test('confidence 0 is OFF by default', () => {
  assert.equal(isAgentEnabledByDefault(0), false);
});

test('confidence 100 is ON by default', () => {
  assert.equal(isAgentEnabledByDefault(100), true);
});

test('fractional confidence 79.9 is OFF (strict <80)', () => {
  assert.equal(isAgentEnabledByDefault(79.9), false);
});

test('fractional confidence 80.0001 is ON', () => {
  assert.equal(isAgentEnabledByDefault(80.0001), true);
});

test('non-numeric confidence throws TypeError', () => {
  assert.throws(() => isAgentEnabledByDefault('80'), TypeError);
  assert.throws(() => isAgentEnabledByDefault(null), TypeError);
  assert.throws(() => isAgentEnabledByDefault(undefined), TypeError);
  assert.throws(() => isAgentEnabledByDefault(NaN), TypeError);
  assert.throws(() => isAgentEnabledByDefault(Infinity), TypeError);
});

test('out-of-range confidence throws RangeError', () => {
  assert.throws(() => isAgentEnabledByDefault(-1), RangeError);
  assert.throws(() => isAgentEnabledByDefault(101), RangeError);
});

test('is pure: repeated calls return identical results', () => {
  for (let i = 0; i <= 100; i += 1) {
    const expected = i >= 80;
    assert.equal(isAgentEnabledByDefault(i), expected);
    assert.equal(isAgentEnabledByDefault(i), expected);
  }
});
