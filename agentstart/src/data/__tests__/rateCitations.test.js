// Sub-AC 7.2: Verify the citation/source metadata module returns a cited
// source (name + URL, plus structured publisher/dataset/SOC fields) for
// each persona's hourly rate.
//
// Required check: every persona must have a non-empty source citation.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  rateCitations,
  getRateCitation,
  getAllRateCitations,
  getCitationLink,
  OEWS_PUBLISHER,
  OEWS_DATASET,
} = require('../rateCitations');

const { VALID_PERSONA_IDS, hourlyRates } = require('../hourlyRates');

const REQUIRED_PERSONA_IDS = [
  'editor',
  'financial_advisor',
  'teacher',
  'project_manager',
  'customer_service_rep',
];

// ── Coverage ────────────────────────────────────────────────────────────

test('rateCitations covers exactly the five required personas', () => {
  const ids = Object.keys(rateCitations).sort();
  assert.deepEqual(ids, REQUIRED_PERSONA_IDS.sort());
});

test('rateCitations covers every persona declared in hourlyRates', () => {
  for (const personaId of VALID_PERSONA_IDS) {
    assert.ok(
      rateCitations[personaId],
      `missing citation for persona "${personaId}"`
    );
  }
});

// ── Non-empty source citation (Sub-AC 7.2 acceptance check) ────────────

test('every persona has a non-empty source citation (name + url)', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const citation = rateCitations[personaId];

    // Name must be a non-empty string
    assert.equal(
      typeof citation.name,
      'string',
      `${personaId}: citation.name must be a string`
    );
    assert.ok(
      citation.name.trim().length > 0,
      `${personaId}: citation.name must be non-empty`
    );

    // URL must be a non-empty string and look like an http(s) URL
    assert.equal(
      typeof citation.url,
      'string',
      `${personaId}: citation.url must be a string`
    );
    assert.ok(
      citation.url.trim().length > 0,
      `${personaId}: citation.url must be non-empty`
    );
    assert.match(
      citation.url,
      /^https?:\/\/\S+$/,
      `${personaId}: citation.url must be a valid http(s) URL, got "${citation.url}"`
    );
  }
});

test('every citation has all required structured fields', () => {
  const requiredFields = [
    'name',
    'url',
    'publisher',
    'dataset',
    'soc_code',
    'accessed',
  ];
  for (const [personaId, citation] of Object.entries(rateCitations)) {
    for (const field of requiredFields) {
      assert.ok(
        typeof citation[field] === 'string' && citation[field].length > 0,
        `${personaId}: citation.${field} must be a non-empty string`
      );
    }
  }
});

test('every citation points to a BLS OEWS occupation page', () => {
  for (const [personaId, citation] of Object.entries(rateCitations)) {
    assert.match(
      citation.url,
      /^https:\/\/www\.bls\.gov\/oes\//,
      `${personaId}: citation.url must point to bls.gov/oes, got "${citation.url}"`
    );
    assert.equal(
      citation.publisher,
      OEWS_PUBLISHER,
      `${personaId}: publisher must be "${OEWS_PUBLISHER}"`
    );
    assert.equal(
      citation.dataset,
      OEWS_DATASET,
      `${personaId}: dataset must be "${OEWS_DATASET}"`
    );
  }
});

test('every citation SOC code is well-formed and matches hourlyRates', () => {
  const SOC_PATTERN = /^\d{2}-\d{4}$/;
  for (const [personaId, citation] of Object.entries(rateCitations)) {
    assert.match(
      citation.soc_code,
      SOC_PATTERN,
      `${personaId}: soc_code must match XX-XXXX format, got "${citation.soc_code}"`
    );
    assert.equal(
      citation.soc_code,
      hourlyRates[personaId].soc_code,
      `${personaId}: citation.soc_code must match hourlyRates.${personaId}.soc_code`
    );
  }
});

test('every citation name references the SOC code', () => {
  for (const [personaId, citation] of Object.entries(rateCitations)) {
    assert.ok(
      citation.name.includes(citation.soc_code),
      `${personaId}: citation.name should reference the SOC code "${citation.soc_code}"`
    );
  }
});

test('citation URLs are unique across personas', () => {
  const urls = Object.values(rateCitations).map((c) => c.url);
  const unique = new Set(urls);
  assert.equal(
    unique.size,
    urls.length,
    `expected unique citation URLs per persona, got duplicates: ${urls.join(', ')}`
  );
});

// ── Helper functions ────────────────────────────────────────────────────

test('getRateCitation returns the correct citation for every persona', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const result = getRateCitation(personaId);
    const expected = rateCitations[personaId];
    assert.equal(result.name, expected.name);
    assert.equal(result.url, expected.url);
    assert.equal(result.publisher, expected.publisher);
    assert.equal(result.dataset, expected.dataset);
    assert.equal(result.soc_code, expected.soc_code);
    assert.equal(result.accessed, expected.accessed);
  }
});

test('getRateCitation returns a fresh copy (mutation-safe)', () => {
  const a = getRateCitation('editor');
  a.name = 'mutated';
  const b = getRateCitation('editor');
  assert.notEqual(b.name, 'mutated', 'getRateCitation must return a fresh copy');
});

test('getRateCitation throws on unknown persona ID', () => {
  assert.throws(
    () => getRateCitation('astronaut'),
    /Unknown persona ID/,
    'expected error for unknown persona ID'
  );
  // The error message should help the developer recover
  assert.throws(
    () => getRateCitation('pilot'),
    (err) =>
      /Unknown persona ID/.test(err.message) &&
      (err.message.includes('Valid IDs are:') ||
        err.message.includes('editor')),
    'error should list valid persona IDs'
  );
});

test('getAllRateCitations returns all five citations as a fresh map', () => {
  const all = getAllRateCitations();
  assert.equal(Object.keys(all).length, 5);
  for (const personaId of REQUIRED_PERSONA_IDS) {
    assert.ok(all[personaId], `missing ${personaId} in getAllRateCitations()`);
    assert.equal(all[personaId].url, rateCitations[personaId].url);
  }
  // Mutating the returned map must not leak into the source
  all.editor.url = 'https://example.com/mutated';
  assert.notEqual(
    rateCitations.editor.url,
    'https://example.com/mutated',
    'getAllRateCitations() must return a fresh copy'
  );
});

test('getCitationLink returns just { name, url } for inline rendering', () => {
  for (const personaId of REQUIRED_PERSONA_IDS) {
    const link = getCitationLink(personaId);
    assert.deepEqual(
      Object.keys(link).sort(),
      ['name', 'url'],
      `getCitationLink("${personaId}") must return exactly { name, url }`
    );
    assert.ok(link.name.length > 0);
    assert.ok(link.url.length > 0);
    assert.equal(link.name, rateCitations[personaId].name);
    assert.equal(link.url, rateCitations[personaId].url);
  }
});

test('getCitationLink throws on unknown persona ID', () => {
  assert.throws(
    () => getCitationLink('unknown_role'),
    /Unknown persona ID/
  );
});
