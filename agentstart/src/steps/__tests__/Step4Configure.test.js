// Integration tests for Step4Configure — the agent configuration step.
//
// Per Sub-AC 4.4 the container must compose three pieces:
//   1. The 80%-confidence threshold function (isAgentEnabledByDefault).
//   2. The persona-scoped agent data (getAgentsForPersona).
//   3. The AgentToggle component (one per agent).
// The integration contract: agents whose automation_confidence >= 80 must
// render as ON; agents below 80 must render as OFF. These tests exercise the
// real data module and the real toggle component — only the DOM is stubbed —
// so a regression in any of the three collaborators surfaces here.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStep4Configure } = require('../Step4Configure');
const { personas } = require('../../data/personas');
const { getAgentsForPersona } = require('../../data/agentDetails');
const {
  isAgentEnabledByDefault,
  AGENT_AUTO_ENABLE_THRESHOLD,
} = require('../../lib/agentToggleDefault');

// Minimal DOM stub mirroring the one used by sibling step tests. Mutable
// property assignment on nodes is essential because the real DOM permits it
// and Step4Configure leans on it for `nextButton`, `backButton`, etc.
function createFakeDocument() {
  function makeNode(tagName) {
    const listeners = {};
    return {
      tagName,
      children: [],
      attributes: {},
      className: '',
      textContent: '',
      style: '',
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
      addEventListener(event, handler) {
        (listeners[event] = listeners[event] || []).push(handler);
      },
      dispatch(event) {
        (listeners[event] || []).forEach((h) => h());
      },
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

test('Step4Configure renders one AgentToggle per persona agent', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const root = createStep4Configure({ persona, document: doc });

    const expectedAgents = getAgentsForPersona(persona.persona_id);
    assert.equal(
      root.toggles.length,
      expectedAgents.length,
      `persona ${persona.persona_id} should render one toggle per agent ` +
        `(expected ${expectedAgents.length}, got ${root.toggles.length})`
    );
  }
});

test(
  'Step4Configure: agents with confidence >= 80% render ON, ' +
    'others render OFF (per Seed threshold)',
  () => {
    for (const persona of personas) {
      const doc = createFakeDocument();
      const root = createStep4Configure({ persona, document: doc });
      const expectedAgents = getAgentsForPersona(persona.persona_id);
      const enabled = root.getEnabledState();

      for (const agent of expectedAgents) {
        const shouldBeOn = isAgentEnabledByDefault(agent.automation_confidence);
        const above = agent.automation_confidence >= AGENT_AUTO_ENABLE_THRESHOLD;

        // Sanity-check that the threshold helper agrees with the raw policy.
        assert.equal(
          shouldBeOn,
          above,
          'threshold helper drifted from the 80% rule'
        );

        // The container's enabled-state map must match the threshold.
        assert.equal(
          enabled[agent.agent_name],
          shouldBeOn,
          `persona ${persona.persona_id}: agent "${agent.agent_name}" ` +
            `with confidence ${agent.automation_confidence}% should be ` +
            `${shouldBeOn ? 'ON' : 'OFF'} by default`
        );
      }
    }
  }
);

test(
  'Step4Configure: each rendered AgentToggle has data-enabled attribute ' +
    'consistent with the threshold',
  () => {
    for (const persona of personas) {
      const doc = createFakeDocument();
      const root = createStep4Configure({ persona, document: doc });
      const expectedAgents = getAgentsForPersona(persona.persona_id);

      for (let i = 0; i < expectedAgents.length; i++) {
        const agent = expectedAgents[i];
        const toggle = root.toggles[i];
        const shouldBeOn = isAgentEnabledByDefault(agent.automation_confidence);

        assert.equal(
          toggle.attributes['data-agent-name'],
          agent.agent_name,
          `toggle ${i} should reference agent "${agent.agent_name}"`
        );
        assert.equal(
          toggle.attributes['data-enabled'],
          shouldBeOn ? 'true' : 'false',
          `toggle for "${agent.agent_name}" (confidence ${agent.automation_confidence}%) ` +
            `should render data-enabled="${shouldBeOn}"`
        );
        assert.equal(
          toggle.isEnabled(),
          shouldBeOn,
          `toggle.isEnabled() for "${agent.agent_name}" should be ${shouldBeOn}`
        );
      }
    }
  }
);

test(
  'Step4Configure: every persona has at least one agent enabled by default ' +
    '(seed demands "a few" auto-enabled per persona)',
  () => {
    for (const persona of personas) {
      const doc = createFakeDocument();
      const root = createStep4Configure({ persona, document: doc });
      const enabled = root.getEnabledState();
      const onCount = Object.values(enabled).filter(Boolean).length;
      assert.ok(
        onCount >= 1,
        `persona ${persona.persona_id} should have >=1 agent on by default, got ${onCount}`
      );
    }
  }
);

test('Step4Configure: a low-confidence agent renders OFF by default', () => {
  // Inject a synthetic agent list to prove the container actually defers to
  // the threshold helper rather than blindly defaulting on. The persona is
  // real; only the agent list is mocked.
  const doc = createFakeDocument();
  const mockedAgents = [
    {
      agent_name: 'High Confidence Agent',
      agent_description: 'desc',
      automation_confidence: 95,
    },
    {
      agent_name: 'Exactly Threshold Agent',
      agent_description: 'desc',
      automation_confidence: 80,
    },
    {
      agent_name: 'Below Threshold Agent',
      agent_description: 'desc',
      automation_confidence: 79,
    },
    {
      agent_name: 'Low Confidence Agent',
      agent_description: 'desc',
      automation_confidence: 40,
    },
  ];

  const root = createStep4Configure({
    persona: personas[0],
    document: doc,
    getAgents: () => mockedAgents,
  });

  const enabled = root.getEnabledState();
  assert.equal(enabled['High Confidence Agent'], true);
  assert.equal(enabled['Exactly Threshold Agent'], true, '80% is inclusive');
  assert.equal(enabled['Below Threshold Agent'], false, '79% is below threshold');
  assert.equal(enabled['Low Confidence Agent'], false);
});

test('Step4Configure: toggling a switch updates the enabled-state map', () => {
  const doc = createFakeDocument();
  const persona = personas[0];
  const root = createStep4Configure({ persona, document: doc });

  const firstToggle = root.toggles[0];
  const agentName = firstToggle.attributes['data-agent-name'];
  const initialState = root.getEnabledState()[agentName];

  firstToggle.toggle();

  assert.equal(
    root.getEnabledState()[agentName],
    !initialState,
    'flipping a toggle should invert that agent\'s enabled state'
  );
});

test('Step4Configure: persona argument is required', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createStep4Configure({ document: doc }),
    /persona/
  );
});

test('Step4Configure: onBack / onNext callbacks are wired when provided', () => {
  const doc = createFakeDocument();
  const events = [];
  const root = createStep4Configure({
    persona: personas[0],
    document: doc,
    onBack: () => events.push('back'),
    onNext: () => events.push('next'),
  });

  assert.ok(root.backButton, 'expected a back button when onBack provided');
  assert.ok(root.nextButton, 'expected a next button when onNext provided');

  root.nextButton.dispatch('click');
  root.backButton.dispatch('click');
  assert.deepEqual(events, ['next', 'back']);
});
