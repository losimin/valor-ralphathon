// Unit tests for the persona data module.
// Runs on Node's built-in test runner: `node --test`.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  personas,
  getPersonaById,
  loadAnalysis,
  getPersonaIds,
  REQUIRED_PERSONA_KEYS,
  REQUIRED_TASK_KEYS,
  CONFIDENCE_THRESHOLD,
  validatePersonaDeep,
  validatePersonaOrThrow,
} = require('../personas');

const {
  validatePersona,
  validateTask,
  PERSONA_FIELD_SCHEMA,
  TASK_FIELD_SCHEMA,
  TOOLS_BY_PERSONA,
} = require('../personaSchema');

const EXPECTED_PERSONA_NAMES = [
  'Editor',
  'Financial Advisor',
  'Teacher',
  'Project Manager',
  'Customer Service Representative',
];

test('exports an array of exactly 5 personas', () => {
  assert.ok(Array.isArray(personas), 'personas must be an array');
  assert.equal(personas.length, 5);
});

test('personas cover the five required roles by name', () => {
  const names = personas.map((p) => p.persona_name).sort();
  assert.deepEqual(names, [...EXPECTED_PERSONA_NAMES].sort());
});

test('every persona has the required top-level keys', () => {
  for (const persona of personas) {
    for (const key of REQUIRED_PERSONA_KEYS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(persona, key),
        `persona ${persona.persona_id} missing key ${key}`
      );
    }
    assert.equal(typeof persona.persona_id, 'string');
    assert.equal(typeof persona.persona_name, 'string');
    assert.equal(typeof persona.hourly_rate, 'number');
    assert.ok(persona.hourly_rate > 0, 'hourly_rate must be positive');
    assert.equal(typeof persona.rate_source, 'string');
    assert.ok(persona.rate_source.length > 10, 'rate_source must be a real citation');
  }
});

test('each persona has 3–5 tasks', () => {
  for (const persona of personas) {
    assert.ok(
      persona.tasks.length >= 3 && persona.tasks.length <= 5,
      `${persona.persona_name} has ${persona.tasks.length} tasks; expected 3–5`
    );
  }
});

test('every task has the full required key set', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      for (const key of REQUIRED_TASK_KEYS) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(task, key),
          `${persona.persona_name} task "${task.task_name}" missing key ${key}`
        );
      }
    }
  }
});

test('agent_enabled tracks the 80% confidence threshold', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      const expected = task.automation_confidence >= CONFIDENCE_THRESHOLD;
      assert.equal(
        task.agent_enabled,
        expected,
        `${task.agent_name} agent_enabled mismatch (conf=${task.automation_confidence})`
      );
    }
  }
});

test('each persona has at least 2 auto-enabled agents', () => {
  for (const persona of personas) {
    const enabled = persona.tasks.filter((t) => t.agent_enabled).length;
    assert.ok(
      enabled >= 2,
      `${persona.persona_name} only has ${enabled} auto-enabled agents`
    );
  }
});

test('each persona has exactly 2 tasks with simulated demos', () => {
  for (const persona of personas) {
    const demos = persona.tasks.filter((t) => t.has_demo).length;
    assert.equal(
      demos,
      2,
      `${persona.persona_name} has ${demos} demo tasks; expected 2`
    );
  }
});

test('ROI fields are positive and internally consistent', () => {
  for (const persona of personas) {
    for (const task of persona.tasks) {
      const hoursSaved = task.current_hours_weekly - task.projected_hours_weekly;
      assert.ok(hoursSaved > 0, `${task.task_name} has no hours saved`);
      assert.ok(task.roi_weekly > 0, `${task.task_name} roi_weekly must be > 0`);
      assert.ok(
        task.roi_monthly > task.roi_weekly,
        `${task.task_name} roi_monthly must exceed roi_weekly`
      );
      assert.ok(
        task.roi_annual > task.roi_monthly,
        `${task.task_name} roi_annual must exceed roi_monthly`
      );
      // roi_annual should equal roi_weekly × 52
      assert.equal(
        task.roi_annual,
        task.roi_weekly * 52,
        `${task.task_name}: roi_annual (${task.roi_annual}) should equal roi_weekly × 52 (${task.roi_weekly * 52})`
      );
      assert.ok(
        task.confidence_interval_low <= task.confidence_interval_high,
        `${task.task_name} CI bounds inverted`
      );
    }
  }
});

// ── Sub-AC 3c: Data loading function accepts a persona identifier ──────────

test('getPersonaById returns correct persona for every valid id', () => {
  const ids = ['editor', 'financial_advisor', 'teacher', 'project_manager', 'customer_service_rep'];
  for (const id of ids) {
    const persona = getPersonaById(id);
    assert.equal(persona.persona_id, id, `getPersonaById("${id}") should return the matching persona`);
    assert.equal(typeof persona.persona_name, 'string');
    assert.ok(persona.persona_name.length > 0);
    assert.equal(typeof persona.hourly_rate, 'number');
    assert.ok(persona.hourly_rate > 0);
    assert.equal(typeof persona.rate_source, 'string');
    assert.ok(persona.rate_source.length > 10);
    assert.ok(Array.isArray(persona.tasks));
    assert.ok(persona.tasks.length >= 3);
  }
});

test('getPersonaById returns object with all required top-level keys', () => {
  const persona = getPersonaById('editor');
  for (const key of REQUIRED_PERSONA_KEYS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(persona, key),
      `getPersonaById result missing key: ${key}`
    );
  }
});

test('getPersonaById returns tasks with all required fields', () => {
  const persona = getPersonaById('teacher');
  for (const task of persona.tasks) {
    for (const key of REQUIRED_TASK_KEYS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(task, key),
        `task "${task.task_name}" missing key: ${key}`
      );
    }
  }
});

test('getPersonaById throws on unknown persona_id', () => {
  assert.throws(
    () => getPersonaById('astronaut'),
    /unknown persona_id/
  );
  assert.throws(
    () => getPersonaById(''),
    /non-empty string/
  );
});

test('getPersonaById throws on non-string input', () => {
  assert.throws(
    () => getPersonaById(null),
    /non-empty string/
  );
  assert.throws(
    () => getPersonaById(undefined),
    /non-empty string/
  );
  assert.throws(
    () => getPersonaById(42),
    /non-empty string/
  );
});

test('getPersonaById returns the same object reference as the personas array (identity)', () => {
  // The function should return the exact pre-built persona object, not a copy.
  for (const persona of personas) {
    const result = getPersonaById(persona.persona_id);
    assert.strictEqual(
      result,
      persona,
      `getPersonaById("${persona.persona_id}") should return the same object`
    );
  }
});

test('loadAnalysis is an exact alias for getPersonaById', () => {
  const ids = ['editor', 'financial_advisor', 'teacher', 'project_manager', 'customer_service_rep'];
  for (const id of ids) {
    const fromGet = getPersonaById(id);
    const fromLoad = loadAnalysis(id);
    assert.strictEqual(fromLoad, fromGet, `loadAnalysis("${id}") should equal getPersonaById("${id}")`);
  }
});

test('loadAnalysis throws on the same invalid inputs', () => {
  assert.throws(() => loadAnalysis('nobody'), /unknown persona_id/);
  assert.throws(() => loadAnalysis(null), /non-empty string/);
  assert.throws(() => loadAnalysis(''), /non-empty string/);
});

test('getPersonaIds returns all five persona identifiers', () => {
  const ids = getPersonaIds();
  const expected = ['editor', 'financial_advisor', 'teacher', 'project_manager', 'customer_service_rep'];
  assert.deepEqual(ids.sort(), expected.sort());
  assert.equal(ids.length, 5);
});

test('getPersonaById returns persona with pre-computed task fields (no recomputation needed)', () => {
  const persona = getPersonaById('customer_service_rep');
  for (const task of persona.tasks) {
    // Every ontology field should be present and pre-computed
    assert.ok(typeof task.time_saved_pct === 'number', `${task.task_name}: time_saved_pct must be number`);
    assert.ok(typeof task.roi_weekly === 'number', `${task.task_name}: roi_weekly must be number`);
    assert.ok(typeof task.roi_monthly === 'number', `${task.task_name}: roi_monthly must be number`);
    assert.ok(typeof task.roi_annual === 'number', `${task.task_name}: roi_annual must be number`);
    assert.ok(typeof task.agent_enabled === 'boolean', `${task.task_name}: agent_enabled must be boolean`);
    assert.ok(task.roi_weekly > 0, `${task.task_name}: roi_weekly must be positive`);
    assert.ok(task.roi_monthly > 0, `${task.task_name}: roi_monthly must be positive`);
    assert.ok(task.roi_annual > 0, `${task.task_name}: roi_annual must be positive`);
    // has_demo must be boolean (not undefined/null)
    assert.ok(typeof task.has_demo === 'boolean', `${task.task_name}: has_demo must be boolean`);
  }
});
