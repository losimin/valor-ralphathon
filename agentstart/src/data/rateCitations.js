// AgentStart — Hourly Rate Citation / Source Metadata Module
//
// Sub-AC 7.2: This module is the canonical source of structured citation
// metadata for each persona's hourly_rate. While hourlyRates.js carries
// the rate values and a free-form `source_detail` paragraph, this module
// exposes a structured citation object with the fields downstream UI
// components need to render an inline source link:
//
//   { name, url, publisher, dataset, soc_code, accessed }
//
// The split keeps "what the rate is" (hourlyRates.js) separate from
// "where the rate came from" (this module). Downstream wizard steps that
// display a "Source: BLS OEWS" link next to the hourly rate read from
// here; analytics / ROI math reads from hourlyRates.js.
//
// All citations point to the U.S. Bureau of Labor Statistics (BLS)
// Occupational Employment and Wage Statistics (OEWS), May 2023 release.

const { VALID_PERSONA_IDS } = require('./hourlyRates');

const OEWS_PUBLISHER = 'U.S. Bureau of Labor Statistics';
const OEWS_DATASET = 'Occupational Employment and Wage Statistics (OEWS), May 2023';
const OEWS_ACCESSED = '2025-05';

/**
 * Structured citation for each persona's hourly rate.
 *
 * Each entry contains:
 *   - name:       human-readable citation label (publisher + occupation)
 *   - url:        canonical URL to the BLS OEWS occupation page
 *   - publisher:  organization that produced the data
 *   - dataset:    name + release of the dataset
 *   - soc_code:   Standard Occupational Classification code
 *   - accessed:   YYYY-MM the data was retrieved
 */
const rateCitations = {
  editor: {
    name: 'BLS OEWS — Editors (SOC 27-3041)',
    url: 'https://www.bls.gov/oes/current/oes273041.htm',
    publisher: OEWS_PUBLISHER,
    dataset: OEWS_DATASET,
    soc_code: '27-3041',
    accessed: OEWS_ACCESSED,
  },
  financial_advisor: {
    name: 'BLS OEWS — Personal Financial Advisors (SOC 13-2052)',
    url: 'https://www.bls.gov/oes/current/oes132052.htm',
    publisher: OEWS_PUBLISHER,
    dataset: OEWS_DATASET,
    soc_code: '13-2052',
    accessed: OEWS_ACCESSED,
  },
  teacher: {
    name:
      'BLS OEWS — Secondary School Teachers, Except Special and Career/Technical Education (SOC 25-2031)',
    url: 'https://www.bls.gov/oes/current/oes252031.htm',
    publisher: OEWS_PUBLISHER,
    dataset: OEWS_DATASET,
    soc_code: '25-2031',
    accessed: OEWS_ACCESSED,
  },
  project_manager: {
    name: 'BLS OEWS — Project Management Specialists (SOC 13-1082)',
    url: 'https://www.bls.gov/oes/current/oes131082.htm',
    publisher: OEWS_PUBLISHER,
    dataset: OEWS_DATASET,
    soc_code: '13-1082',
    accessed: OEWS_ACCESSED,
  },
  customer_service_rep: {
    name: 'BLS OEWS — Customer Service Representatives (SOC 43-4051)',
    url: 'https://www.bls.gov/oes/current/oes434051.htm',
    publisher: OEWS_PUBLISHER,
    dataset: OEWS_DATASET,
    soc_code: '43-4051',
    accessed: OEWS_ACCESSED,
  },
};

/**
 * Look up the structured citation metadata for a persona's hourly rate.
 *
 * @param {string} personaId — one of: editor, financial_advisor, teacher,
 *   project_manager, customer_service_rep
 * @returns {{
 *   name: string,
 *   url: string,
 *   publisher: string,
 *   dataset: string,
 *   soc_code: string,
 *   accessed: string,
 * }} a fresh copy of the citation (safe to mutate by the caller)
 * @throws {Error} if personaId is not a known persona
 */
function getRateCitation(personaId) {
  const citation = rateCitations[personaId];
  if (!citation) {
    throw new Error(
      `Unknown persona ID: "${personaId}". Valid IDs are: ${VALID_PERSONA_IDS.join(', ')}.`
    );
  }
  return { ...citation };
}

/**
 * Return the full citation map (fresh shallow copy).
 * @returns {Record<string, object>}
 */
function getAllRateCitations() {
  const out = {};
  for (const [id, c] of Object.entries(rateCitations)) {
    out[id] = { ...c };
  }
  return out;
}

/**
 * Convenience: return just the (name, url) pair for inline-link rendering.
 * @param {string} personaId
 * @returns {{ name: string, url: string }}
 */
function getCitationLink(personaId) {
  const { name, url } = getRateCitation(personaId);
  return { name, url };
}

module.exports = {
  rateCitations,
  getRateCitation,
  getAllRateCitations,
  getCitationLink,
  OEWS_PUBLISHER,
  OEWS_DATASET,
  OEWS_ACCESSED,
};
