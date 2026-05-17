// AgentStart — Hourly Rates Data Module
//
// Defines role-specific market average hourly rates with cited sources for
// all five personas. This module is the single source of truth for wage
// data used across the wizard (KPI dashboard, ROI calculations, etc.).
//
// All rates are derived from the U.S. Bureau of Labor Statistics (BLS)
// Occupational Employment and Wage Statistics (OEWS), May 2023 release:
//   https://www.bls.gov/oes/current/oes_nat.htm
//
// Hourly rates are computed from reported mean annual wages assuming a
// standard 2,080-hour work-year (40 hrs × 52 weeks):
//   hourly ≈ mean_annual / 2080  (rounded to nearest whole dollar)
//
// Efficiency estimates for time savings are anchored to:
//   - Eloundou et al. (2023), "GPTs are GPTs: An Early Look at the Labor
//     Market Impact Potential of Large Language Models," arXiv:2303.10130.
//   - Anthropic Economic Index reports (2024–2025):
//     "Which Economic Tasks are Performed with AI?"

const RATE_SOURCE_BASE =
  'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics (OEWS), May 2023 release. https://www.bls.gov/oes/current/oes_nat.htm';

const hourlyRates = {
  editor: {
    persona_id: 'editor',
    persona_name: 'Editor',
    hourly_rate: 36,
    mean_annual_wage: 74060,
    occupation_title: 'Editors',
    soc_code: '27-3041',
    source_detail:
      'BLS OEWS May 2023 — Editors (SOC 27-3041), mean annual wage $74,060. Equivalent to ~$36/hr based on 2,080 work-year hours.',
  },
  financial_advisor: {
    persona_id: 'financial_advisor',
    persona_name: 'Financial Advisor',
    hourly_rate: 67,
    mean_annual_wage: 137740,
    occupation_title: 'Personal Financial Advisors',
    soc_code: '13-2052',
    source_detail:
      'BLS OEWS May 2023 — Personal Financial Advisors (SOC 13-2052), mean annual wage $137,740. Equivalent to ~$67/hr based on 2,080 work-year hours.',
  },
  teacher: {
    persona_id: 'teacher',
    persona_name: 'Teacher',
    hourly_rate: 32,
    mean_annual_wage: 65540,
    occupation_title: 'Secondary School Teachers',
    soc_code: '25-2031',
    source_detail:
      'BLS OEWS May 2023 — Secondary School Teachers, Except Special and Career/Technical Education (SOC 25-2031), mean annual wage $65,540. Equivalent to ~$32/hr based on 2,080 work-year hours. Note: many teachers work less than 52 weeks/year; the wage is annualized here for consistency with other roles.',
  },
  project_manager: {
    persona_id: 'project_manager',
    persona_name: 'Project Manager',
    hourly_rate: 56,
    mean_annual_wage: 116000,
    occupation_title: 'Project Management Specialists',
    soc_code: '13-1082',
    source_detail:
      'BLS OEWS May 2023 — Project Management Specialists (SOC 13-1082), mean annual wage $116,000. Equivalent to ~$56/hr based on 2,080 work-year hours. Rounded from $55.77.',
  },
  customer_service_rep: {
    persona_id: 'customer_service_rep',
    persona_name: 'Customer Service Representative',
    hourly_rate: 19,
    mean_annual_wage: 39680,
    occupation_title: 'Customer Service Representatives',
    soc_code: '43-4051',
    source_detail:
      'BLS OEWS May 2023 — Customer Service Representatives (SOC 43-4051), mean annual wage $39,680. Equivalent to ~$19/hr based on 2,080 work-year hours.',
  },
};

/**
 * Look up the hourly rate for a given persona ID.
 * @param {string} personaId — one of: editor, financial_advisor, teacher,
 *   project_manager, customer_service_rep
 * @returns {number} the hourly rate in USD
 */
function getHourlyRate(personaId) {
  const entry = hourlyRates[personaId];
  if (!entry) {
    throw new Error(`Unknown persona ID: ${personaId}`);
  }
  return entry.hourly_rate;
}

/**
 * Look up the full rate entry (rate + citation) for a persona ID.
 * @param {string} personaId
 * @returns {{ persona_id: string, persona_name: string, hourly_rate: number,
 *   mean_annual_wage: number, occupation_title: string, soc_code: string,
 *   source_detail: string }}
 */
function getRateEntry(personaId) {
  const entry = hourlyRates[personaId];
  if (!entry) {
    throw new Error(`Unknown persona ID: ${personaId}`);
  }
  return { ...entry };
}

/**
 * Return the full map of all persona rate entries.
 * @returns {Record<string, object>}
 */
function getAllRateEntries() {
  return { ...hourlyRates };
}

/**
 * Return an ordered list of rate entries sorted by persona name.
 * @returns {Array<object>}
 */
function getAllRateEntriesList() {
  return Object.values(hourlyRates).sort((a, b) =>
    a.persona_name.localeCompare(b.persona_name)
  );
}

/**
 * Return a compact map of persona_id → hourly_rate for quick lookup.
 * @returns {Record<string, number>}
 */
function getRateMap() {
  const map = {};
  for (const [id, entry] of Object.entries(hourlyRates)) {
    map[id] = entry.hourly_rate;
  }
  return map;
}

/**
 * Look up the hourly rate and source citation for a given persona ID.
 *
 * Returns exactly the two ontology-level fields — hourly_rate (number) and
 * rate_source (string) — that downstream consumers (personas.js, KPI
 * dashboard, ROI display) need without exposing internal data fields.
 *
 * @param {string} personaId — one of: editor, financial_advisor, teacher,
 *   project_manager, customer_service_rep
 * @returns {{ hourly_rate: number, rate_source: string }}
 * @throws {Error} if personaId is not a valid persona identifier
 */
function lookupRate(personaId) {
  const entry = hourlyRates[personaId];
  if (!entry) {
    throw new Error(
      `Unknown persona ID: "${personaId}". Valid IDs are: ${VALID_PERSONA_IDS.join(', ')}.`
    );
  }
  return {
    hourly_rate: entry.hourly_rate,
    rate_source: entry.source_detail,
  };
}

/**
 * Validate that all required persona IDs are present in the rate data.
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateCoverage(requiredIds) {
  const missing = requiredIds.filter((id) => !hourlyRates[id]);
  return { valid: missing.length === 0, missing };
}

const VALID_PERSONA_IDS = Object.keys(hourlyRates);

module.exports = {
  hourlyRates,
  getHourlyRate,
  getRateEntry,
  lookupRate,
  getAllRateEntries,
  getAllRateEntriesList,
  getRateMap,
  validateCoverage,
  VALID_PERSONA_IDS,
  RATE_SOURCE_BASE,
};
