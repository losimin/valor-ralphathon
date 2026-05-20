// AgentStart — persona data module
//
// Hourly rates are imported from the hourlyRates data module, which is
// the single source of truth for role-specific wage data. All rates are
// from the U.S. Bureau of Labor Statistics, OEWS May 2023 release:
//   https://www.bls.gov/oes/current/oes_nat.htm
//
// Time-saved % and confidence intervals are anchored to:
//   - Eloundou et al. (2023), "GPTs are GPTs: An Early Look at the Labor
//     Market Impact Potential of Large Language Models," arXiv:2303.10130.
//   - Anthropic, "Which Economic Tasks are Performed with AI?" (Anthropic
//     Economic Index, 2024–2025 reports).
//
// Each task carries the full ontology field set so downstream wizard steps
// (KPI dashboard, workflow diagram, agent config) can render without
// recomputation. agent_enabled is precomputed against the 80% confidence
// threshold defined in the seed.

const { getHourlyRate, getRateEntry } = require('./hourlyRates');
const { TOOLS_BY_PERSONA, REQUIRED_PERSONA_KEYS: SCHEMA_PERSONA_KEYS, REQUIRED_TASK_KEYS: SCHEMA_TASK_KEYS, validatePersonaDeep, validatePersonaOrThrow } = require('./personaSchema');

const CONFIDENCE_THRESHOLD = 80;

/**
 * Build a task object with computed ROI and agent_enabled fields.
 * Keeps inline data terse while guaranteeing every required ontology field
 * is present and internally consistent.
 */
function buildTask(hourlyRate, t) {
  const timeSavedPct = Math.round(
    ((t.current_hours_weekly - t.projected_hours_weekly) /
      t.current_hours_weekly) *
      100
  );
  const hoursSavedWeekly = t.current_hours_weekly - t.projected_hours_weekly;
  const roiWeekly = Math.round(hoursSavedWeekly * hourlyRate);
  const roiMonthly = Math.round(roiWeekly * 4.33);
  const roiAnnual = Math.round(hoursSavedWeekly * hourlyRate * 52);
  return {
    task_name: t.task_name,
    task_frequency: t.task_frequency,
    current_hours_weekly: t.current_hours_weekly,
    projected_hours_weekly: t.projected_hours_weekly,
    human_only_time: t.human_only_time ?? t.current_hours_weekly,
    human_with_ai_time: t.human_with_ai_time ?? t.projected_hours_weekly,
    exposure_to_llm:
      t.exposure_to_llm ||
      (t.automation_confidence >= CONFIDENCE_THRESHOLD
        ? 'Automation'
        : 'Augmentation'),
    time_saved_pct: timeSavedPct,
    confidence_interval_low: t.confidence_interval_low,
    confidence_interval_high: t.confidence_interval_high,
    automation_confidence: t.automation_confidence,
    agent_name: t.agent_name,
    agent_description: t.agent_description,
    agent_enabled: t.automation_confidence >= CONFIDENCE_THRESHOLD,
    has_demo: Boolean(t.demo_context && t.demo_response),
    demo_context: t.demo_context || null,
    demo_response: t.demo_response || null,
    roi_weekly: roiWeekly,
    roi_monthly: roiMonthly,
    roi_annual: roiAnnual,
  };
}

const personaSeeds = [
  {
    persona_id: 'editor',
    persona_name: 'Editor',
    hourly_rate: getHourlyRate('editor'),
    rate_source: getRateEntry('editor').source_detail,
    tools_used: TOOLS_BY_PERSONA.editor,
    tasks: [
      {
        task_name: 'Copyedit drafts for grammar and style',
        task_frequency: 5,
        current_hours_weekly: 12,
        projected_hours_weekly: 3,
        confidence_interval_low: 65,
        confidence_interval_high: 82,
        automation_confidence: 92,
        agent_name: 'Copyedit Agent',
        agent_description:
          'Applies house style guide, fixes grammar, flags ambiguous phrasing, and proposes tightened sentences with tracked changes.',
        demo_context: {
          input_type: 'draft article',
          word_count: 1850,
          style_guide: 'AP Style',
          excerpt:
            'The companys new product, which was released last tuesday, have been recieved well by customers.',
        },
        demo_response: {
          summary: '14 edits proposed, 3 style-guide violations flagged.',
          edits: [
            "company's (apostrophe)",
            'Tuesday (capitalization)',
            'has been received (subject-verb + spelling)',
          ],
          confidence: 0.94,
        },
      },
      {
        task_name: 'Fact-check claims and sources',
        task_frequency: 4,
        current_hours_weekly: 8,
        projected_hours_weekly: 3,
        confidence_interval_low: 45,
        confidence_interval_high: 70,
        automation_confidence: 78,
        agent_name: 'Fact-Check Agent',
        agent_description:
          'Cross-references claims against trusted sources, flags unverified statements, and attaches citation links.',
      },
      {
        task_name: 'Write headlines and SEO metadata',
        task_frequency: 3,
        current_hours_weekly: 4,
        projected_hours_weekly: 1,
        confidence_interval_low: 60,
        confidence_interval_high: 85,
        automation_confidence: 88,
        agent_name: 'Headline & SEO Agent',
        agent_description:
          'Generates 5 headline variants and SEO metadata optimized for CTR and target keywords.',
        demo_context: {
          input_type: 'article body',
          target_keywords: ['remote work', 'productivity'],
          tone: 'professional',
        },
        demo_response: {
          headlines: [
            'The Quiet Productivity Win Hidden in Remote Work',
            'Why Remote Teams Are Outperforming the Office',
            'Remote Work: The Productivity Data Leaders Missed',
          ],
          meta_description:
            'New data shows remote teams ship 23% more — here is what managers should change today.',
          confidence: 0.91,
        },
      },
      {
        task_name: 'Coordinate with writers on revisions',
        task_frequency: 4,
        current_hours_weekly: 6,
        projected_hours_weekly: 4,
        confidence_interval_low: 20,
        confidence_interval_high: 45,
        automation_confidence: 55,
        agent_name: 'Revision Coordinator',
        agent_description:
          'Drafts revision request emails, tracks deadlines, and summarizes outstanding feedback per writer.',
      },
    ],
  },
  {
    persona_id: 'financial_advisor',
    persona_name: 'Financial Advisor',
    hourly_rate: getHourlyRate('financial_advisor'),
    rate_source: getRateEntry('financial_advisor').source_detail,
    tools_used: TOOLS_BY_PERSONA.financial_advisor,
    tasks: [
      {
        task_name: 'Prepare client portfolio review reports',
        task_frequency: 5,
        current_hours_weekly: 10,
        projected_hours_weekly: 3,
        confidence_interval_low: 55,
        confidence_interval_high: 78,
        automation_confidence: 86,
        agent_name: 'Portfolio Report Agent',
        agent_description:
          'Pulls latest holdings, computes performance vs benchmarks, drafts narrative commentary, and assembles a branded PDF.',
        demo_context: {
          client: 'Acme Family Trust',
          aum: 4250000,
          period: 'Q1 2026',
          benchmark: '60/40 blended',
        },
        demo_response: {
          headline: 'Portfolio +4.2% vs benchmark +3.1% for Q1 2026.',
          highlights: [
            'Equity sleeve outperformed by 180 bps',
            'Fixed income drag of 30 bps from duration',
            'Recommend rebalance: trim US LCG +1.5%',
          ],
          confidence: 0.9,
        },
      },
      {
        task_name: 'Respond to client questions via email',
        task_frequency: 5,
        current_hours_weekly: 8,
        projected_hours_weekly: 3,
        confidence_interval_low: 40,
        confidence_interval_high: 65,
        automation_confidence: 81,
        agent_name: 'Client Inbox Agent',
        agent_description:
          'Drafts compliant email replies to routine client questions with citations to plan documents; routes complex items for review.',
      },
      {
        task_name: 'Run retirement scenario modeling',
        task_frequency: 3,
        current_hours_weekly: 6,
        projected_hours_weekly: 2,
        confidence_interval_low: 50,
        confidence_interval_high: 75,
        automation_confidence: 84,
        agent_name: 'Retirement Modeler',
        agent_description:
          'Generates Monte Carlo projections under user-specified assumptions and produces a one-page summary.',
        demo_context: {
          client_age: 58,
          target_retirement: 65,
          current_savings: 980000,
          annual_contribution: 30000,
        },
        demo_response: {
          success_probability: 0.87,
          median_terminal_wealth: 2150000,
          recommendation:
            'On track. Increase equity allocation 5% to lift floor scenarios.',
          confidence: 0.88,
        },
      },
      {
        task_name: 'Compliance documentation and KYC updates',
        task_frequency: 2,
        current_hours_weekly: 4,
        projected_hours_weekly: 2,
        confidence_interval_low: 25,
        confidence_interval_high: 50,
        automation_confidence: 62,
        agent_name: 'Compliance Doc Agent',
        agent_description:
          'Pre-fills KYC forms from CRM data and flags fields needing advisor confirmation.',
      },
    ],
  },
  {
    persona_id: 'teacher',
    persona_name: 'Teacher',
    hourly_rate: getHourlyRate('teacher'),
    rate_source: getRateEntry('teacher').source_detail,
    tools_used: TOOLS_BY_PERSONA.teacher,
    tasks: [
      {
        task_name: 'Grade student assignments and essays',
        task_frequency: 5,
        current_hours_weekly: 10,
        projected_hours_weekly: 4,
        confidence_interval_low: 45,
        confidence_interval_high: 70,
        automation_confidence: 82,
        agent_name: 'Grading Assistant',
        agent_description:
          'Scores assignments against rubric, drafts personalized feedback, and surfaces edge cases for teacher review.',
        demo_context: {
          assignment: '5-paragraph essay on The Great Gatsby',
          rubric: 'thesis / evidence / analysis / mechanics',
          student_count: 28,
        },
        demo_response: {
          processed: 28,
          flagged_for_review: 4,
          mean_score: 82,
          sample_feedback:
            "Strong thesis on the green light symbolism. Strengthen paragraph 3 by adding a direct quote from Chapter 5.",
          confidence: 0.89,
        },
      },
      {
        task_name: 'Build lesson plans and materials',
        task_frequency: 4,
        current_hours_weekly: 6,
        projected_hours_weekly: 2,
        confidence_interval_low: 50,
        confidence_interval_high: 75,
        automation_confidence: 85,
        agent_name: 'Lesson Plan Agent',
        agent_description:
          'Generates standards-aligned lesson plans, slides, and exit tickets from a topic and grade level.',
      },
      {
        task_name: 'Draft parent communications',
        task_frequency: 3,
        current_hours_weekly: 3,
        projected_hours_weekly: 1,
        confidence_interval_low: 55,
        confidence_interval_high: 80,
        automation_confidence: 87,
        agent_name: 'Parent Comms Agent',
        agent_description:
          'Drafts individualized progress updates and meeting requests in the teacher’s voice with tracked send approval.',
        demo_context: {
          student: 'Jamie R.',
          topic: 'recent improvement in algebra',
          tone: 'warm, specific',
        },
        demo_response: {
          subject: 'Quick update on Jamie’s algebra progress',
          body: "Hi Ms. Rivera, I wanted to share that Jamie scored 94% on this week's quiz — a 22-point jump. Their approach to multi-step equations has clearly clicked. We will keep building on this.",
          confidence: 0.93,
        },
      },
      {
        task_name: 'Differentiate instruction for IEP students',
        task_frequency: 3,
        current_hours_weekly: 4,
        projected_hours_weekly: 2,
        confidence_interval_low: 25,
        confidence_interval_high: 50,
        automation_confidence: 68,
        agent_name: 'IEP Differentiation Helper',
        agent_description:
          'Suggests scaffolds and modifications for each lesson aligned to active IEP goals.',
      },
    ],
  },
  {
    persona_id: 'project_manager',
    persona_name: 'Project Manager',
    hourly_rate: getHourlyRate('project_manager'),
    rate_source: getRateEntry('project_manager').source_detail,
    tools_used: TOOLS_BY_PERSONA.project_manager,
    tasks: [
      {
        task_name: 'Compile weekly status reports',
        task_frequency: 5,
        current_hours_weekly: 6,
        projected_hours_weekly: 1,
        confidence_interval_low: 65,
        confidence_interval_high: 85,
        automation_confidence: 93,
        agent_name: 'Status Report Agent',
        agent_description:
          'Aggregates updates from Jira, GitHub, and Slack into a one-page status report with risks and next steps.',
        demo_context: {
          project: 'Atlas Migration',
          week: 'W19 2026',
          sources: ['Jira', 'GitHub', 'Slack #atlas'],
        },
        demo_response: {
          rag_status: 'Amber',
          highlights: [
            '3 of 5 milestones on track',
            'Auth migration slipping 4 days — vendor dependency',
            'Decision needed: dual-write window length',
          ],
          confidence: 0.92,
        },
      },
      {
        task_name: 'Run stand-ups and capture action items',
        task_frequency: 5,
        current_hours_weekly: 5,
        projected_hours_weekly: 2,
        confidence_interval_low: 40,
        confidence_interval_high: 65,
        automation_confidence: 80,
        agent_name: 'Standup Scribe',
        agent_description:
          'Transcribes stand-ups, extracts action items with owners and dates, and posts a summary to Slack.',
      },
      {
        task_name: 'Maintain project schedules and Gantt charts',
        task_frequency: 4,
        current_hours_weekly: 5,
        projected_hours_weekly: 2,
        confidence_interval_low: 35,
        confidence_interval_high: 60,
        automation_confidence: 74,
        agent_name: 'Schedule Keeper',
        agent_description:
          'Reconciles task updates against the baseline plan and proposes timeline adjustments.',
      },
      {
        task_name: 'Draft stakeholder communications',
        task_frequency: 3,
        current_hours_weekly: 4,
        projected_hours_weekly: 1,
        confidence_interval_low: 55,
        confidence_interval_high: 78,
        automation_confidence: 88,
        agent_name: 'Stakeholder Comms Agent',
        agent_description:
          'Generates audience-appropriate updates (exec, customer, eng) from the same source data.',
        demo_context: {
          audience: 'executive sponsors',
          situation: 'milestone slip on auth migration',
          length: 'short',
        },
        demo_response: {
          subject: 'Atlas Migration — auth milestone slip, mitigation in place',
          body: 'Auth cut-over moves from May 22 to May 26 due to a vendor SSO change. No downstream milestone impact; budget unchanged. Mitigation: parallel test in staging continues this week.',
          confidence: 0.9,
        },
      },
      {
        task_name: 'Risk and issue log maintenance',
        task_frequency: 2,
        current_hours_weekly: 3,
        projected_hours_weekly: 1,
        confidence_interval_low: 30,
        confidence_interval_high: 55,
        automation_confidence: 70,
        agent_name: 'Risk Log Agent',
        agent_description:
          'Detects new risks from meeting notes and PR descriptions, updates the log, and notifies the owner.',
      },
    ],
  },
  {
    persona_id: 'customer_service_rep',
    persona_name: 'Customer Service Representative',
    hourly_rate: getHourlyRate('customer_service_rep'),
    rate_source: getRateEntry('customer_service_rep').source_detail,
    tools_used: TOOLS_BY_PERSONA.customer_service_rep,
    tasks: [
      {
        task_name: 'Respond to inbound support tickets',
        task_frequency: 5,
        current_hours_weekly: 20,
        projected_hours_weekly: 6,
        confidence_interval_low: 55,
        confidence_interval_high: 80,
        automation_confidence: 90,
        agent_name: 'Tier-1 Response Agent',
        agent_description:
          'Drafts replies to common ticket categories grounded in the knowledge base; escalates anything outside policy.',
        demo_context: {
          ticket_id: 'T-48219',
          category: 'refund request',
          customer_tier: 'standard',
          order_age_days: 12,
        },
        demo_response: {
          draft_reply:
            'Hi Sam — sorry the jacket didn’t work out. I’ve started your refund of $128.40 to the original card; you should see it in 3–5 business days. A prepaid return label is attached.',
          policy_check: 'within 30-day window — auto-approved',
          confidence: 0.94,
        },
      },
      {
        task_name: 'Categorize and route incoming tickets',
        task_frequency: 5,
        current_hours_weekly: 6,
        projected_hours_weekly: 1,
        confidence_interval_low: 70,
        confidence_interval_high: 90,
        automation_confidence: 95,
        agent_name: 'Triage Agent',
        agent_description:
          'Classifies tickets by intent, priority, and product area; assigns to the right queue.',
      },
      {
        task_name: 'Handle live chat conversations',
        task_frequency: 4,
        current_hours_weekly: 12,
        projected_hours_weekly: 6,
        confidence_interval_low: 35,
        confidence_interval_high: 60,
        automation_confidence: 76,
        agent_name: 'Chat Copilot',
        agent_description:
          'Suggests next replies, surfaces relevant KB articles, and auto-fills order lookups during live chat.',
        demo_context: {
          channel: 'web chat',
          customer_intent: 'order status',
          order_id: 'ORD-77310',
        },
        demo_response: {
          suggested_reply:
            'Your order ORD-77310 shipped yesterday via UPS and is out for delivery today before 8pm. Tracking: 1Z999AA1...',
          kb_articles: ['Tracking a recent order', 'Delivery exceptions'],
          confidence: 0.86,
        },
      },
      {
        task_name: 'Process returns and refunds',
        task_frequency: 4,
        current_hours_weekly: 5,
        projected_hours_weekly: 2,
        confidence_interval_low: 50,
        confidence_interval_high: 72,
        automation_confidence: 83,
        agent_name: 'Returns Agent',
        agent_description:
          'Validates return eligibility, issues labels, and posts refunds within policy bounds.',
      },
      {
        task_name: 'Write QA notes and call summaries',
        task_frequency: 3,
        current_hours_weekly: 3,
        projected_hours_weekly: 1,
        confidence_interval_low: 45,
        confidence_interval_high: 70,
        automation_confidence: 85,
        agent_name: 'Call Summary Agent',
        agent_description:
          'Produces structured call summaries and QA notes from recorded interactions.',
      },
    ],
  },
];

const personas = personaSeeds.map((p) => ({
  persona_id: p.persona_id,
  persona_name: p.persona_name,
  hourly_rate: p.hourly_rate,
  rate_source: p.rate_source,
  rate_detail: getRateEntry(p.persona_id),
  tools_used: p.tools_used,
  tasks: p.tasks.map((t) => buildTask(p.hourly_rate, t)),
}));

// Use the canonical schema definitions from personaSchema.js so there is a
// single source of truth for which keys are required on personas and tasks.
const REQUIRED_PERSONA_KEYS = SCHEMA_PERSONA_KEYS;
const REQUIRED_TASK_KEYS = SCHEMA_TASK_KEYS;

/**
 * Look up a single persona by its persona_id string and return the
 * pre-populated analysis object containing all ontology fields.
 *
 * This is the canonical data-loading entry point for the wizard: Step 2
 * (KPIs), Step 3 (workflow), Step 4 (config), and Step 5 (completion) all
 * consume the object returned here. The returned object carries every
 * computed field (ROI, time_saved_pct, agent_enabled, confidence intervals)
 * so downstream steps can render without recomputation.
 *
 * @param {string} personaId — one of: editor, financial_advisor, teacher,
 *   project_manager, customer_service_rep
 * @returns {object} the full persona analysis object
 * @throws {Error} if personaId is not a valid persona identifier
 */
function getPersonaById(personaId) {
  if (typeof personaId !== 'string' || !personaId) {
    throw new Error(
      'getPersonaById: `personaId` must be a non-empty string'
    );
  }
  const persona = personas.find((p) => p.persona_id === personaId);
  if (!persona) {
    throw new Error(
      `getPersonaById: unknown persona_id "${personaId}". ` +
      `Valid IDs are: ${personas.map((p) => p.persona_id).join(', ')}.`
    );
  }
  return persona;
}

/**
 * Alias for getPersonaById — loads the pre-populated analysis object for a
 * persona identifier. This name explicitly matches the Seed ontology's
 * "pre-populated analysis object" concept so callers (especially the
 * wizard's analysis step) can use the most domain-appropriate name.
 *
 * @param {string} personaId
 * @returns {object} the full persona analysis object
 * @throws {Error} if personaId is not a valid persona identifier
 */
function loadAnalysis(personaId) {
  return getPersonaById(personaId);
}

/**
 * Return the list of all valid persona identifiers.
 * @returns {string[]}
 */
function getPersonaIds() {
  return personas.map((p) => p.persona_id);
}

module.exports = {
  personas,
  personaSeeds,
  getPersonaById,
  loadAnalysis,
  getPersonaIds,
  CONFIDENCE_THRESHOLD,
  REQUIRED_PERSONA_KEYS,
  REQUIRED_TASK_KEYS,
  validatePersonaDeep,
  validatePersonaOrThrow,
};
