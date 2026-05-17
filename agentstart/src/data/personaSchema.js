// AgentStart — Persona Data Schema & Validation Module
//
// Defines the canonical schema for persona and task objects used across the
// AgentStart wizard. This module is the authoritative reference for what
// constitutes a valid persona in the system. Every field is documented with
// its expected type, constraints, and whether it is required.
//
// The schema aligns with the AgentAuditWorkflow ontology defined in the Seed
// contract and serves as the single source of truth for data validation.
//
// Exports:
//   - PERSONA_FIELD_SCHEMA  — structured field definitions for persona objects
//   - TASK_FIELD_SCHEMA     — structured field definitions for task objects
//   - VALID_PERSONA_IDS     — the five canonical persona identifiers
//   - REQUIRED_PERSONA_KEYS — flat list of required persona-level keys
//   - REQUIRED_TASK_KEYS    — flat list of required task-level keys
//   - TOOLS_BY_PERSONA      — canonical tools_used mapping per persona (Sub-AC 1.1.1)
//   - validatePersona(obj)  — validates a persona object, returns { valid, errors }
//   - validateTask(obj)     — validates a task object, returns { valid, errors }
//   - validatePersonaOrThrow(obj) — validates persona, throws if invalid

const VALID_PERSONA_IDS = [
  'editor',
  'financial_advisor',
  'teacher',
  'project_manager',
  'customer_service_rep',
];

const VALID_PERSONA_NAMES = [
  'Editor',
  'Financial Advisor',
  'Teacher',
  'Project Manager',
  'Customer Service Representative',
];

// ── Structured field definitions ───────────────────────────────────────────
//
// Each field definition carries:
//   - type:       expected JavaScript typeof result (or 'array', 'integer')
//   - required:   whether the field must be present (boolean)
//   - constraint: human-readable validation rule
//   - check:      a predicate function (value) => boolean for programmatic use

const PERSONA_FIELD_SCHEMA = {
  persona_id: {
    type: 'string',
    required: true,
    constraint: 'Must be one of the five valid persona identifiers',
    check: (v) => typeof v === 'string' && VALID_PERSONA_IDS.includes(v),
  },
  persona_name: {
    type: 'string',
    required: true,
    constraint: 'Must be the display name matching the persona_id',
    check: (v) => typeof v === 'string' && VALID_PERSONA_NAMES.includes(v),
  },
  hourly_rate: {
    type: 'number',
    required: true,
    constraint: 'Must be a positive number (role-specific market average in USD)',
    check: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  },
  rate_source: {
    type: 'string',
    required: true,
    constraint: 'Must cite the source (BLS OEWS) for the hourly rate',
    check: (v) => typeof v === 'string' && v.length > 10,
  },
  tools_used: {
    type: 'array',
    required: true,
    constraint: 'Must be a non-empty array of tool name strings the persona uses daily',
    check: (v) =>
      Array.isArray(v) &&
      v.length >= 1 &&
      v.every((t) => typeof t === 'string' && t.trim().length > 0),
  },
  tasks: {
    type: 'array',
    required: true,
    constraint: 'Must be an array of 3–5 valid task objects',
    check: (v) => Array.isArray(v) && v.length >= 3 && v.length <= 5,
  },
};

const TASK_FIELD_SCHEMA = {
  task_name: {
    type: 'string',
    required: true,
    constraint: 'Must be a non-empty string describing the task',
    check: (v) => typeof v === 'string' && v.trim().length > 0,
  },
  task_frequency: {
    type: 'number',
    required: true,
    constraint: 'Must be a positive integer (relative frequency ranking 1–5)',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5,
  },
  current_hours_weekly: {
    type: 'number',
    required: true,
    constraint: 'Must be a positive number of hours currently spent per week',
    check: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  },
  projected_hours_weekly: {
    type: 'number',
    required: true,
    constraint: 'Must be a non-negative number less than current_hours_weekly',
    check: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  },
  time_saved_pct: {
    type: 'number',
    required: true,
    constraint: 'Must be a whole-number percentage (0–100) of time saved',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100,
  },
  confidence_interval_low: {
    type: 'number',
    required: true,
    constraint: 'Lower bound of 95% CI (0–100), must be ≤ confidence_interval_high',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100,
  },
  confidence_interval_high: {
    type: 'number',
    required: true,
    constraint: 'Upper bound of 95% CI (0–100), must be ≥ confidence_interval_low',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100,
  },
  automation_confidence: {
    type: 'number',
    required: true,
    constraint: 'Confidence score 0–100 that an agent can handle this task',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100,
  },
  agent_name: {
    type: 'string',
    required: true,
    constraint: 'Must be a non-empty name for the AI agent',
    check: (v) => typeof v === 'string' && v.trim().length > 0,
  },
  agent_description: {
    type: 'string',
    required: true,
    constraint: 'Must describe what the agent does in at least 10 characters',
    check: (v) => typeof v === 'string' && v.trim().length >= 10,
  },
  agent_enabled: {
    type: 'boolean',
    required: true,
    constraint: 'Must be a boolean; true if automation_confidence >= 80%',
    check: (v) => typeof v === 'boolean',
  },
  has_demo: {
    type: 'boolean',
    required: true,
    constraint: 'Must be a boolean indicating whether demo data is present',
    check: (v) => typeof v === 'boolean',
  },
  demo_context: {
    type: 'object|null',
    required: true,
    constraint: 'Must be null or an object containing demo input context',
    check: (v) => v === null || (typeof v === 'object' && v !== null && !Array.isArray(v)),
  },
  demo_response: {
    type: 'object|null',
    required: true,
    constraint: 'Must be null or an object containing hardcoded agent output',
    check: (v) => v === null || (typeof v === 'object' && v !== null && !Array.isArray(v)),
  },
  roi_weekly: {
    type: 'number',
    required: true,
    constraint: 'Must be a positive integer (USD weekly ROI)',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v > 0,
  },
  roi_monthly: {
    type: 'number',
    required: true,
    constraint: 'Must be a positive integer > roi_weekly (USD monthly ROI)',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v > 0,
  },
  roi_annual: {
    type: 'number',
    required: true,
    constraint: 'Must equal roi_weekly * 52 (USD annual ROI)',
    check: (v) =>
      typeof v === 'number' && Number.isInteger(v) && v > 0,
  },
};

// ── Flat key lists (for quick presence checks) ─────────────────────────────

const REQUIRED_PERSONA_KEYS = Object.keys(PERSONA_FIELD_SCHEMA).filter(
  (k) => PERSONA_FIELD_SCHEMA[k].required
);

const REQUIRED_TASK_KEYS = Object.keys(TASK_FIELD_SCHEMA).filter(
  (k) => TASK_FIELD_SCHEMA[k].required
);

// ── Canonical tools_used mapping ───────────────────────────────────────────
//
// Each persona's daily toolkit, used as the source of truth for the
// "tools used" field in the persona data. Step 1 (persona selection) and
// the KPI dashboard can optionally surface the tools list to give users
// immediate context about the persona's workflow.

const TOOLS_BY_PERSONA = {
  editor: [
    'Google Docs',
    'Grammarly',
    'WordPress CMS',
    'Hemingway Editor',
    'Trello',
  ],
  financial_advisor: [
    'Bloomberg Terminal',
    'Microsoft Excel',
    'Salesforce CRM',
    'Morningstar Direct',
    'eMoney Advisor',
  ],
  teacher: [
    'Google Classroom',
    'Kahoot',
    'Zoom',
    'Canva',
    'Turnitin',
  ],
  project_manager: [
    'Jira',
    'Slack',
    'Microsoft Project',
    'Confluence',
    'GitHub',
  ],
  customer_service_rep: [
    'Zendesk',
    'Salesforce',
    'Intercom',
    'Jira',
    'Slack',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a single field against its schema definition.
 *
 * @param {string} fieldName - the field key
 * @param {*} value - the value to validate
 * @param {object} schemaEntry - the field definition from PERSONA_FIELD_SCHEMA
 *                                or TASK_FIELD_SCHEMA
 * @returns {string|null} error message, or null if valid
 */
function validateField(fieldName, value, schemaEntry) {
  // Check type
  const expectedType = schemaEntry.type;
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== expectedType) {
    // Special case: null is typeof 'object' but we allow it with 'object|null'
    if (expectedType === 'object|null' && value === null) {
      // ok — null is explicitly allowed
    } else if (expectedType === 'object|null' && actualType === 'object') {
      if (Array.isArray(value)) {
        return `${fieldName}: expected null or plain object, got array`;
      }
      // ok — plain object
    } else {
      return `${fieldName}: expected type "${expectedType}", got "${actualType}"`;
    }
  }

  // Run the constraint check
  if (!schemaEntry.check(value)) {
    return `${fieldName}: ${schemaEntry.constraint} (got: ${JSON.stringify(value)})`;
  }

  return null;
}

/**
 * Validate a persona object against the full persona-level schema.
 * Checks that every required field is present, has the correct type, and
 * satisfies its constraints. Also verifies that persona_name and persona_id
 * are consistent with each other.
 *
 * @param {object} persona - the persona object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePersona(persona) {
  const errors = [];

  if (!persona || typeof persona !== 'object' || Array.isArray(persona)) {
    return { valid: false, errors: ['persona: must be a non-null plain object'] };
  }

  // Check every required field
  for (const [fieldName, schema] of Object.entries(PERSONA_FIELD_SCHEMA)) {
    if (schema.required && !Object.prototype.hasOwnProperty.call(persona, fieldName)) {
      errors.push(`${fieldName}: missing required field`);
      continue;
    }

    if (persona[fieldName] !== undefined) {
      const err = validateField(fieldName, persona[fieldName], schema);
      if (err) errors.push(err);
    }
  }

  // Cross-field consistency: persona_id ↔ persona_name
  if (persona.persona_id && persona.persona_name) {
    const expectedName = {
      editor: 'Editor',
      financial_advisor: 'Financial Advisor',
      teacher: 'Teacher',
      project_manager: 'Project Manager',
      customer_service_rep: 'Customer Service Representative',
    }[persona.persona_id];

    if (expectedName && persona.persona_name !== expectedName) {
      errors.push(
        `persona_name: "${persona.persona_name}" does not match persona_id "${persona.persona_id}" (expected "${expectedName}")`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a task object against the full task-level schema.
 * Checks every required field plus cross-field consistency:
 *   - projected_hours < current_hours
 *   - confidence_interval_low ≤ confidence_interval_high
 *   - roi_annual = roi_weekly * 52
 *   - roi_monthly > roi_weekly
 *   - agent_enabled ↔ automation_confidence ≥ 80
 *   - has_demo ↔ demo_context/demo_response presence
 *   - time_saved_pct is consistent with hours ratio
 *
 * @param {object} task - the task object to validate
 * @param {number} [hourlyRate] - optional hourly rate for ROI cross-check
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTask(task, hourlyRate) {
  const errors = [];

  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    return { valid: false, errors: ['task: must be a non-null plain object'] };
  }

  // Check every required field
  for (const [fieldName, schema] of Object.entries(TASK_FIELD_SCHEMA)) {
    if (schema.required && !Object.prototype.hasOwnProperty.call(task, fieldName)) {
      errors.push(`${fieldName}: missing required field`);
      continue;
    }

    if (task[fieldName] !== undefined) {
      const err = validateField(fieldName, task[fieldName], schema);
      if (err) errors.push(err);
    }
  }

  // ── Cross-field consistency checks ──────────────────────────────────────

  // projected_hours must be strictly less than current_hours
  if (
    typeof task.current_hours_weekly === 'number' &&
    typeof task.projected_hours_weekly === 'number'
  ) {
    if (task.projected_hours_weekly >= task.current_hours_weekly) {
      errors.push(
        `projected_hours_weekly (${task.projected_hours_weekly}) must be < current_hours_weekly (${task.current_hours_weekly})`
      );
    }
  }

  // CI bounds: low ≤ high
  if (
    typeof task.confidence_interval_low === 'number' &&
    typeof task.confidence_interval_high === 'number'
  ) {
    if (task.confidence_interval_low > task.confidence_interval_high) {
      errors.push(
        `confidence_interval_low (${task.confidence_interval_low}) must be ≤ confidence_interval_high (${task.confidence_interval_high})`
      );
    }
  }

  // ROI consistency
  if (
    typeof task.roi_weekly === 'number' &&
    typeof task.roi_monthly === 'number' &&
    typeof task.roi_annual === 'number'
  ) {
    if (task.roi_monthly <= task.roi_weekly) {
      errors.push(
        `roi_monthly (${task.roi_monthly}) must be > roi_weekly (${task.roi_weekly})`
      );
    }
    if (task.roi_annual <= task.roi_monthly) {
      errors.push(
        `roi_annual (${task.roi_annual}) must be > roi_monthly (${task.roi_monthly})`
      );
    }
    if (task.roi_annual !== task.roi_weekly * 52) {
      errors.push(
        `roi_annual (${task.roi_annual}) must equal roi_weekly × 52 (${task.roi_weekly * 52})`
      );
    }
  }

  // agent_enabled must match the 80% threshold
  if (
    typeof task.agent_enabled === 'boolean' &&
    typeof task.automation_confidence === 'number'
  ) {
    const expectedEnabled = task.automation_confidence >= 80;
    if (task.agent_enabled !== expectedEnabled) {
      errors.push(
        `agent_enabled (${task.agent_enabled}) does not match automation_confidence ≥ 80% threshold (confidence=${task.automation_confidence})`
      );
    }
  }

  // has_demo must be consistent with demo_context / demo_response
  if (typeof task.has_demo === 'boolean') {
    const hasDemoData = task.demo_context !== null || task.demo_response !== null;
    if (task.has_demo && !hasDemoData) {
      errors.push(
        'has_demo is true but both demo_context and demo_response are null'
      );
    }
    if (!task.has_demo && hasDemoData) {
      errors.push(
        'has_demo is false but demo_context or demo_response is present'
      );
    }
  }

  // time_saved_pct consistency with hours
  if (
    typeof task.time_saved_pct === 'number' &&
    typeof task.current_hours_weekly === 'number' &&
    typeof task.projected_hours_weekly === 'number' &&
    task.current_hours_weekly > 0
  ) {
    const computedPct = Math.round(
      ((task.current_hours_weekly - task.projected_hours_weekly) /
        task.current_hours_weekly) *
        100
    );
    if (task.time_saved_pct !== computedPct) {
      errors.push(
        `time_saved_pct (${task.time_saved_pct}) does not match computed value from hours (${computedPct})`
      );
    }
  }

  // ROI consistency with hourly rate (only when provided)
  if (
    typeof hourlyRate === 'number' &&
    typeof task.current_hours_weekly === 'number' &&
    typeof task.projected_hours_weekly === 'number' &&
    typeof task.roi_weekly === 'number'
  ) {
    const hoursSaved = task.current_hours_weekly - task.projected_hours_weekly;
    const expectedRoi = Math.round(hoursSaved * hourlyRate);
    if (task.roi_weekly !== expectedRoi) {
      errors.push(
        `roi_weekly (${task.roi_weekly}) does not match hours_saved × hourly_rate (${expectedRoi})`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Full persona validation including all nested tasks.
 * Validates the persona object and every task in its tasks array.
 *
 * @param {object} persona - the persona object to validate deeply
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePersonaDeep(persona) {
  const personaResult = validatePersona(persona);
  if (!personaResult.valid) {
    return personaResult;
  }

  const errors = [];

  // Validate each task
  if (Array.isArray(persona.tasks)) {
    if (persona.tasks.length < 3 || persona.tasks.length > 5) {
      errors.push(
        `tasks: expected 3–5 tasks, got ${persona.tasks.length}`
      );
    }
    for (let i = 0; i < persona.tasks.length; i++) {
      const task = persona.tasks[i];
      const taskResult = validateTask(task, persona.hourly_rate);
      if (!taskResult.valid) {
        for (const err of taskResult.errors) {
          errors.push(`tasks[${i}].${err}`);
        }
      }
    }
  } else {
    errors.push('tasks: must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a persona and throw a descriptive error if invalid.
 * Prefer `validatePersona` for non-throwing use; this is a convenience
 * for callers that want to fail fast on bad data.
 *
 * @param {object} persona - the persona object to validate
 * @throws {Error} if the persona is invalid
 */
function validatePersonaOrThrow(persona) {
  const result = validatePersonaDeep(persona);
  if (!result.valid) {
    throw new Error(
      `Invalid persona "${persona?.persona_id || '(unknown)'}":\n` +
        result.errors.map((e) => `  - ${e}`).join('\n')
    );
  }
}

module.exports = {
  PERSONA_FIELD_SCHEMA,
  TASK_FIELD_SCHEMA,
  VALID_PERSONA_IDS,
  VALID_PERSONA_NAMES,
  REQUIRED_PERSONA_KEYS,
  REQUIRED_TASK_KEYS,
  TOOLS_BY_PERSONA,
  validatePersona,
  validateTask,
  validatePersonaDeep,
  validatePersonaOrThrow,
};
