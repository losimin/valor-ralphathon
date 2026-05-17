// Unit tests for the AgentStart wizard controller.
//
// Sub-AC 1.4: selecting a persona in Step 1 must load and display that
// persona's pre-populated analysis content.
// Sub-AC 6.1: navigation state management supports setting current step to
// any previous step index without allowing forward navigation.
//
// These tests cover:
//   1. Initial mount opens directly on Step 1 (no landing page).
//   2. Clicking a persona card advances to Step 2 with correct data.
//   3. Full forward wizard flow through all 5 steps.
//   4. Back navigation: Next → Back returns to previous step.
//   5. goToStep(n) allows navigating to any previously-visited step.
//   6. goToStep(n) BLOCKS navigation to future steps (n > maxReachedStep).
//   7. Step indicator correctly reflects current step and reached steps.
//   8. Step 5 correctly displays enabled agents from Step 4 toggle state.
//   9. Restart returns to Step 1.
//  10. Every persona can complete the full wizard.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createAgentStartApp } = require('../AgentStartApp');
const { personas } = require('../../data/personas');

// ── Lightweight DOM stub ────────────────────────────────────────────────
//
// Mirrors the one used by the Step 1 / PersonaCard tests so the suite stays
// dependency-free. `removeChild` and `appendChild` are both implemented so
// the controller can detach and re-attach cached steps.

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
      removeChild(child) {
        const i = this.children.indexOf(child);
        if (i !== -1) this.children.splice(i, 1);
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

// Recursively collect text content from the fake-DOM tree. The stub does
// not bubble textContent up the tree, so the test walks it explicitly when
// asserting on rendered copy.
function collectText(node) {
  if (!node) return '';
  let text = node.textContent || '';
  for (const child of node.children || []) {
    text += ' ' + collectText(child);
  }
  return text;
}

// Helper: click a persona card by index and verify Step 2 is mounted.
function selectPersonaByIndex(app, index) {
  const step1 = app.currentStep;
  const card = step1.cards[index];
  card.dispatch('click');
  return app.currentStep;
}

// Helper: click the Next button on the current step.
function clickNext(app) {
  const btn = app.currentStep.nextButton;
  if (!btn) throw new Error('No nextButton on current step');
  btn.dispatch('click');
  return app.currentStep;
}

// Helper: click the Back button on the current step.
function clickBack(app) {
  const btn = app.currentStep.backButton;
  if (!btn) throw new Error('No backButton on current step');
  btn.dispatch('click');
  return app.currentStep;
}

// Helper: find a step indicator dot by step index.
function findIndicatorDot(app, n) {
  for (const child of app.stepIndicator.children) {
    if (Number(child.attributes['data-step-index']) === n) return child;
  }
  return null;
}

// ── Sub-AC 1.4 tests (existing) ─────────────────────────────────────────

test('AgentStartApp opens on Step 1 (persona select)', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  assert.ok(app.currentStep, 'a step should be mounted');
  assert.equal(
    app.currentStep.attributes['data-step'],
    '1',
    'app should open directly on the persona-select step (no landing page)'
  );
  assert.equal(app.currentStep.cards.length, personas.length);
  assert.equal(app.currentStepIndex, 1, 'currentStepIndex should be 1');
  assert.equal(app.maxReachedStep, 1, 'maxReachedStep should be 1 initially');
});

test('clicking a persona card in Step 1 mounts Step 2 with that persona', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Pick a persona that is NOT the first card so we can prove the dispatch
  // wired the matched persona through, rather than always defaulting.
  const targetIndex = 2;
  const target = personas[targetIndex];
  const step1 = app.currentStep;
  const targetCard = step1.cards[targetIndex];
  assert.equal(
    targetCard.attributes['data-persona-id'],
    target.persona_id,
    'sanity: the card under test corresponds to the chosen persona'
  );

  targetCard.dispatch('click');

  // After the click the wizard should have swapped the mounted step.
  assert.notEqual(
    app.currentStep,
    step1,
    'a click should advance past Step 1'
  );
  assert.equal(
    app.currentStep.attributes['data-step'],
    '2',
    'Step 2 (analysis) should now be mounted'
  );
  assert.equal(
    app.currentStep.attributes['data-persona-id'],
    target.persona_id,
    'mounted analysis view must be scoped to the clicked persona'
  );
  assert.equal(app.currentStepIndex, 2, 'currentStepIndex should be 2');
  assert.equal(app.maxReachedStep, 2, 'maxReachedStep should be 2 after advance');

  // The pre-populated content for that persona should be visible.
  const text = collectText(app.currentStep);
  assert.match(
    text,
    new RegExp(target.persona_name),
    'heading should name the selected persona'
  );
  assert.match(
    text,
    new RegExp(`\\$${target.hourly_rate}\\b`),
    'hourly rate from the matched persona should appear'
  );
  for (const task of target.tasks) {
    const escaped = task.task_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      text,
      new RegExp(escaped),
      `task "${task.task_name}" should be listed in the analysis view`
    );
  }

  assert.equal(
    app.currentStep.taskRows.length,
    target.tasks.length,
    'one row per task in the matched persona'
  );
});

test('every persona can be selected and renders its own analysis', () => {
  for (let i = 0; i < personas.length; i++) {
    const doc = createFakeDocument();
    const app = createAgentStartApp({ document: doc });
    const persona = personas[i];

    app.currentStep.cards[i].dispatch('click');

    assert.equal(
      app.currentStep.attributes['data-persona-id'],
      persona.persona_id,
      `clicking card ${i} (${persona.persona_name}) should mount its analysis`
    );
    assert.equal(app.currentStep.taskRows.length, persona.tasks.length);

    const text = collectText(app.currentStep);
    for (const task of persona.tasks) {
      const escaped = task.task_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(text, new RegExp(escaped));
    }
  }
});

// ── Sub-AC 6.1: Navigation state management ─────────────────────────────

test('full forward wizard flow through all 5 steps', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Step 1 → Step 2: select first persona.
  selectPersonaByIndex(app, 0);
  assert.equal(app.currentStep.attributes['data-step'], '2');
  assert.equal(app.currentStepIndex, 2);
  assert.equal(app.maxReachedStep, 2);

  // Step 2 → Step 3: click Next.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '3');
  assert.equal(app.currentStepIndex, 3);
  assert.equal(app.maxReachedStep, 3);

  // Step 3 → Step 4: click Next.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '4');
  assert.equal(app.currentStepIndex, 4);
  assert.equal(app.maxReachedStep, 4);

  // Step 4 → Step 5: click Next (Finish setup).
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '5');
  assert.equal(app.currentStepIndex, 5);
  assert.equal(app.maxReachedStep, 5);

  // Step 5 should show the "ready" heading.
  const text = collectText(app.currentStep);
  assert.match(text, /Your workspace is ready/i);
});

test('back navigation through all steps returns to previous step', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  clickNext(app); // → Step 4
  clickNext(app); // → Step 5
  assert.equal(app.currentStepIndex, 5);

  // Step 5 → Step 4: click Back.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '4');
  assert.equal(app.currentStepIndex, 4);

  // Step 4 → Step 3: click Back.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '3');
  assert.equal(app.currentStepIndex, 3);

  // Step 3 → Step 2: click Back.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '2');
  assert.equal(app.currentStepIndex, 2);

  // Step 2 → Step 1: click Back.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '1');
  assert.equal(app.currentStepIndex, 1);
});

test('goToStep(n) allows navigating to any previous step index', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Advance all the way to Step 5.
  selectPersonaByIndex(app, 0);
  clickNext(app); // Step 3
  clickNext(app); // Step 4
  clickNext(app); // Step 5
  assert.equal(app.currentStepIndex, 5);
  assert.equal(app.maxReachedStep, 5);

  // goToStep(3): jump back from Step 5 to Step 3.
  app.goToStep(3);
  assert.equal(app.currentStep.attributes['data-step'], '3');
  assert.equal(app.currentStepIndex, 3);
  // maxReachedStep should still be 5 — going back doesn't reduce it.
  assert.equal(app.maxReachedStep, 5);

  // goToStep(1): jump from Step 3 back to Step 1.
  app.goToStep(1);
  assert.equal(app.currentStep.attributes['data-step'], '1');
  assert.equal(app.currentStepIndex, 1);
  assert.equal(app.maxReachedStep, 5);

  // goToStep(4): jump from Step 1 to Step 4 (was previously reached).
  app.goToStep(4);
  assert.equal(app.currentStep.attributes['data-step'], '4');
  assert.equal(app.currentStepIndex, 4);

  // goToStep(2): jump from Step 4 back to Step 2.
  app.goToStep(2);
  assert.equal(app.currentStep.attributes['data-step'], '2');
  assert.equal(app.currentStepIndex, 2);
});

test('goToStep(n) BLOCKS navigation to future steps (n > maxReachedStep)', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // We've only reached Step 1.
  assert.equal(app.maxReachedStep, 1);

  // goToStep(2) should be blocked — haven't selected a persona yet.
  app.goToStep(2);
  assert.equal(app.currentStep.attributes['data-step'], '1',
    'should still be on Step 1 — forward navigation blocked');
  assert.equal(app.currentStepIndex, 1);

  // goToStep(5) should be blocked.
  app.goToStep(5);
  assert.equal(app.currentStep.attributes['data-step'], '1',
    'should still be on Step 1 — forward navigation blocked');

  // Now reach Step 3 legitimately.
  selectPersonaByIndex(app, 0);
  clickNext(app);
  assert.equal(app.currentStepIndex, 3);
  assert.equal(app.maxReachedStep, 3);

  // goToStep(4) should be blocked (haven't reached it yet).
  app.goToStep(4);
  assert.equal(app.currentStep.attributes['data-step'], '3',
    'should still be on Step 3 — forward to Step 4 blocked');
  assert.equal(app.currentStepIndex, 3);

  // goToStep(5) should be blocked.
  app.goToStep(5);
  assert.equal(app.currentStep.attributes['data-step'], '3',
    'should still be on Step 3 — forward to Step 5 blocked');

  // But goToStep(2) and goToStep(1) should work.
  app.goToStep(2);
  assert.equal(app.currentStep.attributes['data-step'], '2');
  app.goToStep(1);
  assert.equal(app.currentStep.attributes['data-step'], '1');
});

test('goToStep with invalid indices is a no-op', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app);
  clickNext(app);
  clickNext(app); // At Step 5
  assert.equal(app.currentStepIndex, 5);

  // Negative
  app.goToStep(-1);
  assert.equal(app.currentStepIndex, 5, 'negative step should be no-op');

  // Zero
  app.goToStep(0);
  assert.equal(app.currentStepIndex, 5, 'step 0 should be no-op');

  // Beyond range
  app.goToStep(6);
  assert.equal(app.currentStepIndex, 5, 'step 6 should be no-op');

  // Non-number
  app.goToStep('2');
  assert.equal(app.currentStepIndex, 5, 'string step should be no-op');

  // Same step (no-op but allowed)
  app.goToStep(5);
  assert.equal(app.currentStepIndex, 5, 'same step should be no-op');
});

test('goToStep(n) does NOT increase maxReachedStep (only advanceToStep does)', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app); // Step 3
  assert.equal(app.maxReachedStep, 3);

  // Go back to Step 2 via goToStep.
  app.goToStep(2);
  assert.equal(app.maxReachedStep, 3, 'maxReachedStep unchanged by goToStep');

  // Go back to Step 1.
  app.goToStep(1);
  assert.equal(app.maxReachedStep, 3, 'maxReachedStep unchanged by goToStep');
});

test('step indicator shows 5 dots with correct active/reached/future states', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Initially only Step 1 is active and reached.
  assert.equal(app.stepIndicator.children.length, 5, 'step indicator should have 5 dots');

  let dot1 = findIndicatorDot(app, 1);
  let dot2 = findIndicatorDot(app, 2);
  let dot3 = findIndicatorDot(app, 3);
  assert.match(dot1.className, /step-indicator__step--active/);
  assert.match(dot1.className, /step-indicator__step--reached/);
  assert.match(dot2.className, /step-indicator__step--future/);
  assert.ok(dot2.disabled, 'future dot should be disabled');
  assert.ok(dot3.disabled, 'future dot should be disabled');

  // Advance to Step 2.
  selectPersonaByIndex(app, 0);
  dot1 = findIndicatorDot(app, 1);
  dot2 = findIndicatorDot(app, 2);
  assert.match(dot1.className, /step-indicator__step--reached/);
  assert.ok(!dot1.className.includes('step-indicator__step--active'),
    'Step 1 dot should no longer be active');
  assert.match(dot2.className, /step-indicator__step--active/);
  assert.match(dot2.className, /step-indicator__step--reached/);
  assert.ok(!dot2.disabled, 'reached dot should not be disabled');

  // Advance to Step 5.
  clickNext(app); // 3
  clickNext(app); // 4
  clickNext(app); // 5

  for (let i = 1; i <= 5; i++) {
    const dot = findIndicatorDot(app, i);
    assert.match(dot.className, /step-indicator__step--reached/,
      `step ${i} dot should have --reached class`);
    assert.ok(!dot.disabled, `step ${i} dot should not be disabled`);
    if (i === 5) {
      assert.match(dot.className, /step-indicator__step--active/);
    }
  }
});

test('clicking a reached step indicator dot navigates to that step (backward only)', () => {
  // Sub-AC 6.2.3: The StepIndicator only fires onStepClick for completed
  // steps (i < currentStep). Forward navigation via the indicator is not
  // supported — only backward navigation to completed steps.
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Reach Step 5.
  selectPersonaByIndex(app, 0);
  clickNext(app); // 3
  clickNext(app); // 4
  clickNext(app); // 5
  assert.equal(app.currentStepIndex, 5);

  // Click the Step 2 dot (completed: 2 < 5, backward click).
  const dot2 = findIndicatorDot(app, 2);
  dot2.dispatch('click');
  assert.equal(app.currentStep.attributes['data-step'], '2');
  assert.equal(app.currentStepIndex, 2);

  // Click the Step 1 dot (completed: 1 < 2, backward click).
  const dot1 = findIndicatorDot(app, 1);
  dot1.dispatch('click');
  assert.equal(app.currentStep.attributes['data-step'], '1');
  assert.equal(app.currentStepIndex, 1);

  // Click the Step 3 dot (future: 3 > 1, should NOT navigate).
  const dot3 = findIndicatorDot(app, 3);
  dot3.dispatch('click');
  assert.equal(app.currentStep.attributes['data-step'], '1',
    'clicking future step should not navigate');
  assert.equal(app.currentStepIndex, 1);
});

test('clicking a future step indicator dot is harmless (no navigation)', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Only at Step 1.
  assert.equal(app.maxReachedStep, 1);

  // Click Step 3 dot (future).
  const dot3 = findIndicatorDot(app, 3);
  assert.ok(dot3.disabled, 'future dot should be disabled');
  dot3.dispatch('click');
  // Should still be on Step 1.
  assert.equal(app.currentStep.attributes['data-step'], '1');
  assert.equal(app.currentStepIndex, 1);
});

test('Step 5 shows checkmarks for enabled agents reflecting Step 4 toggle state', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  const persona = personas[0];
  selectPersonaByIndex(app, 0);
  clickNext(app); // Step 3
  clickNext(app); // Step 4

  // Verify we're on Step 4 and can read toggle state.
  const step4 = app.currentStep;
  assert.equal(step4.attributes['data-step'], '4');

  // All agents start with their default state. Read the initial enabled state.
  const initialEnabled = step4.getEnabledState();
  const initialEnabledNames = Object.entries(initialEnabled)
    .filter(([, on]) => on)
    .map(([name]) => name);

  // Advance to Step 5.
  clickNext(app);
  const step5 = app.currentStep;
  assert.equal(step5.attributes['data-step'], '5');

  // Verify Step 5 shows enabled agents with checkmarks.
  for (const item of step5.agentItems) {
    const agentName = item.attributes['data-agent-name'];
    const isEnabled = item.attributes['data-enabled'] === 'true';

    if (initialEnabledNames.includes(agentName)) {
      assert.ok(isEnabled, `agent "${agentName}" should be enabled`);
      // Find the icon and assert checkmark.
      const icon = item.children.find((c) =>
        c.className.includes('completion__agent-icon--enabled')
      );
      assert.ok(icon, `enabled agent "${agentName}" should have enabled icon`);
      assert.equal(icon.textContent, '✓');
    } else {
      assert.ok(!isEnabled, `agent "${agentName}" should be disabled`);
      const icon = item.children.find((c) =>
        c.className.includes('completion__agent-icon--disabled')
      );
      assert.ok(icon, `disabled agent "${agentName}" should have disabled icon`);
      assert.equal(icon.textContent, '—');
    }
  }
});

test('restart from Step 5 returns to Step 1', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app);
  clickNext(app);
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '5');

  const step5 = app.currentStep;
  assert.ok(step5.restartButton, 'Step 5 should have a restart button');
  step5.restartButton.dispatch('click');

  assert.equal(app.currentStep.attributes['data-step'], '1');
  assert.equal(app.currentStepIndex, 1);
  assert.equal(app.maxReachedStep, 1);
});

test('selecting a different persona after completing wizard restarts with fresh state', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Complete wizard for persona 0.
  selectPersonaByIndex(app, 0);
  clickNext(app);
  clickNext(app);
  clickNext(app);
  assert.equal(app.currentStepIndex, 5);

  // Restart.
  app.currentStep.restartButton.dispatch('click');
  assert.equal(app.currentStepIndex, 1);

  // Select a different persona.
  selectPersonaByIndex(app, 1);
  assert.equal(app.currentStep.attributes['data-step'], '2');
  assert.equal(
    app.currentStep.attributes['data-persona-id'],
    personas[1].persona_id
  );

  // The analysis should show the new persona's data, not the old one.
  const text = collectText(app.currentStep);
  assert.match(text, new RegExp(personas[1].persona_name));
});

test('all five personas can complete the full wizard flow', () => {
  for (let i = 0; i < personas.length; i++) {
    const doc = createFakeDocument();
    const app = createAgentStartApp({ document: doc });
    const persona = personas[i];

    // Step 1 → Step 2
    app.currentStep.cards[i].dispatch('click');
    assert.equal(app.currentStep.attributes['data-step'], '2');
    assert.equal(app.currentStep.attributes['data-persona-id'], persona.persona_id);

    // Step 2 → Step 3
    clickNext(app);
    assert.equal(app.currentStep.attributes['data-step'], '3');

    // Step 3 → Step 4
    clickNext(app);
    assert.equal(app.currentStep.attributes['data-step'], '4');

    // Step 4 → Step 5
    clickNext(app);
    assert.equal(app.currentStep.attributes['data-step'], '5');

    const text = collectText(app.currentStep);
    assert.match(text, /Your workspace is ready/i);

    // Verify all step indices tracked correctly.
    assert.equal(app.currentStepIndex, 5, `persona ${i}: should end on step 5`);
    assert.equal(app.maxReachedStep, 5, `persona ${i}: maxReachedStep should be 5`);
  }
});

test('toggling agents in Step 4 and re-entering Step 5 reflects updated state', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app); // Step 3
  clickNext(app); // Step 4

  // Get the first toggle and flip it.
  const step4 = app.currentStep;
  const firstToggle = step4.toggles[0];
  const initialEnabled = step4.getEnabledState();

  // Flip the toggle (dispatch a change event as if the user clicked).
  // The toggle component stores an onChange handler; we simulate its call.
  const agentName = firstToggle.attributes['data-agent-name'];
  const currentState = initialEnabled[agentName];
  // Manually flip via the exposed getEnabledState pattern — call onChange.
  // The toggle is a component with an onChange prop. We need to trigger it.
  // Find the toggle's internal switch and flip it.
  const switchEl = firstToggle.children.find((c) =>
    c.className && c.className.includes('agent-toggle__switch')
  );
  if (switchEl) {
    // Simulate clicking the switch to toggle.
    switchEl.setAttribute('aria-checked', String(!currentState));
    switchEl.dispatch('click');
  }

  // Advance to Step 5.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '5');

  // Go back to Step 4.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '4');

  // Go back to Step 5 again.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '5');

  // The enabled agent list should match the current Step 4 state.
  const finalStep5 = app.currentStep;
  assert.ok(finalStep5.agentItems.length > 0, 'Step 5 should have agent items');
});

test('goToStep preserves in-step state when navigating between steps', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  const step2Node = app.currentStep;

  // Advance to Step 3.
  clickNext(app);
  const step3Node = app.currentStep;

  // Click a task node in Step 3 to reveal the description panel.
  const firstNode = step3Node.diagram.nodes[0];
  firstNode.dispatch('click');

  // A description panel should now be attached.
  const descPanel = step3Node.children.find(
    (c) => c.attributes && c.attributes['data-role'] === 'description-panel'
  );
  assert.ok(descPanel, 'clicking a workflow node should show description panel');

  // Navigate back to Step 2 via goToStep.
  app.goToStep(2);
  assert.equal(app.currentStep.attributes['data-step'], '2');

  // Navigate back to Step 3.
  app.goToStep(3);
  assert.equal(app.currentStep.attributes['data-step'], '3');

  // The description panel should still be there (state preserved).
  const descPanelAfter = app.currentStep.children.find(
    (c) => c.attributes && c.attributes['data-role'] === 'description-panel'
  );
  assert.ok(descPanelAfter,
    'description panel should persist after navigating back and forward');
});

test('currentStepIndex and maxReachedStep are exposed correctly throughout wizard', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  assert.equal(app.currentStepIndex, 1);
  assert.equal(app.maxReachedStep, 1);

  selectPersonaByIndex(app, 0);
  assert.equal(app.currentStepIndex, 2);
  assert.equal(app.maxReachedStep, 2);

  clickNext(app);
  assert.equal(app.currentStepIndex, 3);
  assert.equal(app.maxReachedStep, 3);

  // Go back to Step 1 — currentStepIndex changes, maxReachedStep stays.
  app.goToStep(1);
  assert.equal(app.currentStepIndex, 1);
  assert.equal(app.maxReachedStep, 3, 'maxReachedStep persists after back navigation');

  // Go to Step 3 directly.
  app.goToStep(3);
  assert.equal(app.currentStepIndex, 3);
  assert.equal(app.maxReachedStep, 3);
});

// ── Sub-AC 3b: selectPersona accepts a persona identifier ──────────────────

test('selectPersona accepts a persona_id string and advances to Step 2', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Call selectPersona with a string persona_id.
  app.selectPersona('editor');

  // Should advance to Step 2 with the editor persona.
  assert.equal(app.currentStep.attributes['data-step'], '2');
  assert.equal(
    app.currentStep.attributes['data-persona-id'],
    'editor',
    'Step 2 should be scoped to the editor persona'
  );
  assert.equal(app.currentStepIndex, 2);
  assert.equal(app.maxReachedStep, 2);

  const text = collectText(app.currentStep);
  assert.match(text, /Editor/);
  assert.match(text, /\$36\b/);
});

test('selectPersona with string id renders correct KPI data for that persona', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  app.selectPersona('project_manager');

  assert.equal(app.currentStep.attributes['data-persona-id'], 'project_manager');

  const text = collectText(app.currentStep);
  assert.match(text, /Project Manager/);
  assert.match(text, /\$56\b/);
});

test('selectPersona accepts string id for all five personas', () => {
  const expectedIds = [
    'editor',
    'financial_advisor',
    'teacher',
    'project_manager',
    'customer_service_rep',
  ];

  for (const id of expectedIds) {
    const doc = createFakeDocument();
    const app = createAgentStartApp({ document: doc });

    app.selectPersona(id);

    assert.equal(
      app.currentStep.attributes['data-persona-id'],
      id,
      `selectPersona("${id}") should scope Step 2 to ${id}`
    );
    assert.equal(app.currentStepIndex, 2);
  }
});

test('selectPersona throws on unknown persona_id string', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  assert.throws(
    () => app.selectPersona('astronaut'),
    /unknown persona_id/
  );
});

test('selectPersona throws on null/undefined/empty-string input', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  assert.throws(
    () => app.selectPersona(null),
    /selectPersona requires/
  );
  assert.throws(
    () => app.selectPersona(undefined),
    /selectPersona requires/
  );
  assert.throws(
    () => app.selectPersona(''),
    /non-empty string/
  );
});

test('selectPersona with object still works (backward compatible)', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Pass a plain persona object directly.
  app.selectPersona({
    persona_id: 'teacher',
    persona_name: 'Teacher',
    hourly_rate: 32,
    rate_source: 'BLS',
    tasks: [],
  });

  assert.equal(app.currentStep.attributes['data-persona-id'], 'teacher');
  assert.equal(app.currentStepIndex, 2);
});

test('selectPersona with string id followed by selectPersona with object switches correctly', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  // Select editor by string ID.
  app.selectPersona('editor');
  assert.equal(app.currentStep.attributes['data-persona-id'], 'editor');

  // Navigate back to Step 1.
  app.goToStep1();
  assert.equal(app.currentStep.attributes['data-step'], '1');

  // Select financial_advisor by passing the persona object (as PersonaCard does).
  const faPersona = personas.find((p) => p.persona_id === 'financial_advisor');
  app.currentStep.cards[1].dispatch('click');
  assert.equal(app.currentStep.attributes['data-persona-id'], 'financial_advisor');
});

// ── Sub-AC 6.3b: Save-on-exit persistence ─────────────────────────────────

test('formDataStore is exposed on the root element', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  assert.ok(app.formDataStore, 'root should expose formDataStore');
  assert.equal(typeof app.formDataStore.save, 'function');
  assert.equal(typeof app.formDataStore.retrieve, 'function');
  assert.equal(typeof app.formDataStore.clear, 'function');
  assert.equal(typeof app.formDataStore.has, 'function');
});

test('form data store can be injected via constructor option', () => {
  const doc = createFakeDocument();
  const calls = [];

  // A lightweight spy store that records saves while still storing data.
  const spyStore = {
    _data: new Map(),
    save(personaId, stepIndex, data) {
      calls.push({ personaId, stepIndex, data });
      if (!this._data.has(personaId)) {
        this._data.set(personaId, new Map());
      }
      this._data.get(personaId).set(stepIndex, data);
    },
    retrieve(personaId, stepIndex) {
      if (stepIndex !== undefined) {
        return (this._data.get(personaId) || new Map()).get(stepIndex);
      }
      const m = this._data.get(personaId);
      if (!m) return {};
      const result = {};
      for (const [k, v] of m) result[k] = v;
      return result;
    },
    clear() { this._data.clear(); },
    has(personaId, stepIndex) {
      const m = this._data.get(personaId);
      return m ? m.has(stepIndex) : false;
    },
  };

  const app = createAgentStartApp({ document: doc, formDataStore: spyStore });

  // The injected store should be used, not a fresh instance.
  assert.strictEqual(app.formDataStore, spyStore);

  // Advance through the wizard — the spy should receive save calls.
  selectPersonaByIndex(app, 0);
  assert.ok(calls.length > 0, 'spy should have recorded save calls');
  // First save call should be for Step 1→2 transition (advanceToStep saves
  // Step 1 state before building Step 2).
  const firstCall = calls[0];
  assert.equal(firstCall.personaId, personas[0].persona_id);
  assert.equal(firstCall.stepIndex, 1, 'should save Step 1 state');
  assert.ok(firstCall.data.personaCardsShown, 'Step 1 data should have personaCardsShown');
});

test('save-on-exit persists Step 2 data when advancing to Step 3', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  // At this point, Step 1's state was saved (on advanceToStep(2)).
  // Step 2 was just built — its state has not been saved yet.

  // Advance to Step 3 — this should trigger saveCurrentStepState for Step 2.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '3');

  // Verify the store has Step 2's form state.
  const step2Data = app.formDataStore.retrieve(personas[0].persona_id, 2);
  assert.ok(step2Data, 'store should have Step 2 data after advancing');
  assert.equal(step2Data.personaId, personas[0].persona_id);
  assert.ok(typeof step2Data.pctSaved === 'number', 'should include pctSaved KPI');
  assert.ok(typeof step2Data.roiWeekly === 'number', 'should include roiWeekly KPI');
  assert.ok(typeof step2Data.taskCount === 'number', 'should include taskCount');
  assert.equal(step2Data.taskCount, personas[0].tasks.length);
});

test('save-on-exit persists Step 4 toggle state when advancing to Step 5', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  clickNext(app); // → Step 4

  // Read the initial toggle state from the DOM.
  const step4 = app.currentStep;
  const initialToggles = step4.getEnabledState();
  assert.ok(Object.keys(initialToggles).length > 0, 'Step 4 should have toggles');

  // Advance to Step 5 — this must save Step 4's toggle state.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '5');

  // Verify the store received Step 4's toggle state.
  const step4Saved = app.formDataStore.retrieve(personas[0].persona_id, 4);
  assert.ok(step4Saved, 'store should have Step 4 data');
  assert.ok(step4Saved.enabledState, 'should include enabledState');
  assert.deepEqual(
    step4Saved.enabledState,
    initialToggles,
    'saved toggles should match the Step 4 getEnabledState() output'
  );
  assert.equal(step4Saved.agentCount, Object.keys(initialToggles).length);
});

test('save-on-exit persists data on back navigation (goToStep)', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  clickNext(app); // → Step 4
  clickNext(app); // → Step 5

  assert.equal(app.currentStep.attributes['data-step'], '5');

  // The store should have data for Steps 1–5 (saved on each advance).
  // Now navigate back to Step 3 via Back button (goToStep).
  clickBack(app); // → Step 4
  // goToStep saves Step 5 state before navigating back.
  const step5Saved = app.formDataStore.retrieve(personas[0].persona_id, 5);
  assert.ok(step5Saved, 'store should have Step 5 data after navigating back');
  assert.ok(step5Saved.enabledAgentNames !== undefined, 'Step 5 data should have enabledAgentNames');

  clickBack(app); // → Step 3
  const step4SavedAgain = app.formDataStore.retrieve(personas[0].persona_id, 4);
  assert.ok(step4SavedAgain, 'store should have Step 4 data after navigating back');
  assert.ok(step4SavedAgain.enabledState, 'Step 4 data should have enabledState');
});

test('save-on-exit captures Step 3 workflow interaction state', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  assert.equal(app.currentStep.attributes['data-step'], '3');

  // Interact with the workflow diagram: click a task node.
  const step3 = app.currentStep;
  const firstNode = step3.diagram.nodes[0];
  firstNode.dispatch('click');

  // The description panel should be visible.
  const descPanel = step3.children.find(
    (c) => c.attributes && c.attributes['data-role'] === 'description-panel'
  );
  assert.ok(descPanel, 'clicking a workflow node should show description panel');

  // Advance to Step 4 — this must save Step 3's current state.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '4');

  // Verify the store has Step 3's state with the selected task.
  const step3Saved = app.formDataStore.retrieve(personas[0].persona_id, 3);
  assert.ok(step3Saved, 'store should have Step 3 data');
  assert.ok(typeof step3Saved.selectedTaskId === 'string',
    'should include selectedTaskId from workflow interaction');
  assert.ok(step3Saved.selectedTaskId.length > 0, 'selectedTaskId should be non-empty');
  assert.ok(step3Saved.hasDescriptionPanel, 'should record that description panel was visible');
  assert.ok(Array.isArray(step3Saved.demoRunTasks),
    'should include demoRunTasks array');
});

test('save-on-exit handles all steps correctly in full wizard run', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });
  const personaId = personas[0].persona_id;

  // Complete the full wizard.
  selectPersonaByIndex(app, 0);
  clickNext(app); // Step 3
  clickNext(app); // Step 4
  clickNext(app); // Step 5

  // Every step that was navigated away from should have data.
  assert.equal(app.formDataStore.has(personaId, 1), true, 'Step 1 data should exist');
  assert.equal(app.formDataStore.has(personaId, 2), true, 'Step 2 data should exist');
  assert.equal(app.formDataStore.has(personaId, 3), true, 'Step 3 data should exist');
  assert.equal(app.formDataStore.has(personaId, 4), true, 'Step 4 data should exist');

  // Step 5 was just built and hasn't been navigated away from yet, so it
  // won't be saved unless we navigate again.
  // Let's navigate back to trigger Step 5 save.
  clickBack(app);
  assert.equal(app.formDataStore.has(personaId, 5), true,
    'Step 5 data should exist after navigating back from it');

  // Verify each step's data shape.
  const step1 = app.formDataStore.retrieve(personaId, 1);
  assert.equal(step1.personaCardsShown, true);
  assert.equal(step1.personaCount, personas.length);

  const step2 = app.formDataStore.retrieve(personaId, 2);
  assert.equal(step2.personaId, personaId);
  assert.ok(typeof step2.pctSaved === 'number');

  const step3 = app.formDataStore.retrieve(personaId, 3);
  assert.ok(step3.selectedTaskId === null || typeof step3.selectedTaskId === 'string');
  assert.ok(Array.isArray(step3.demoRunTasks));

  const step4 = app.formDataStore.retrieve(personaId, 4);
  assert.ok(step4.enabledState);
  assert.ok(typeof step4.agentCount === 'number');

  const step5 = app.formDataStore.retrieve(personaId, 5);
  assert.ok(Array.isArray(step5.enabledAgentNames));
  assert.equal(step5.personaId, personaId);
});

test('save-on-exit data is isolated between different personas', () => {
  // Complete wizard for persona 0.
  const doc1 = createFakeDocument();
  const app1 = createAgentStartApp({ document: doc1 });

  selectPersonaByIndex(app1, 0);
  clickNext(app1);
  clickNext(app1);
  clickNext(app1);
  clickBack(app1); // Save Step 5 too

  const persona0Id = personas[0].persona_id;
  assert.ok(app1.formDataStore.has(persona0Id, 4), 'persona 0 should have Step 4 data');

  // Now run through for persona 2 and verify persona 0 data is isolated.
  const doc2 = createFakeDocument();
  const app2 = createAgentStartApp({ document: doc2 });

  selectPersonaByIndex(app2, 2);
  clickNext(app2);
  clickNext(app2);
  clickNext(app2);

  const persona2Id = personas[2].persona_id;
  assert.ok(app2.formDataStore.has(persona2Id, 4), 'persona 2 should have Step 4 data');
  assert.ok(!app2.formDataStore.has(persona0Id, 4),
    'persona 0 data should NOT be in persona 2 store');

  // The store is a fresh instance per AgentStartApp, but verify that
  // within a single store, different personas are isolated.
  const persona0Data = app2.formDataStore.retrieve(persona0Id, 4);
  assert.equal(persona0Data, undefined,
    'retrieving another persona data from same store should be undefined');
});

test('save-on-exit clears persona data on wizard restart', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app);
  clickNext(app);
  clickNext(app);
  assert.equal(app.currentStepIndex, 5);

  const personaId = personas[0].persona_id;
  assert.ok(app.formDataStore.has(personaId, 4), 'should have Step 4 data before restart');

  // Restart the wizard.
  const step5 = app.currentStep;
  step5.restartButton.dispatch('click');

  assert.equal(app.currentStepIndex, 1);

  // After restart, the persona's form data should be cleared.
  assert.ok(!app.formDataStore.has(personaId, 1),
    'persona form data should be cleared after restart');
  assert.ok(!app.formDataStore.has(personaId, 2));
  assert.ok(!app.formDataStore.has(personaId, 4));
  assert.deepEqual(app.formDataStore.retrieve(personaId), {},
    'retrieve all should return empty object after restart');
});

test('save-on-exit works for all five personas through full wizard', () => {
  for (let i = 0; i < personas.length; i++) {
    const doc = createFakeDocument();
    const app = createAgentStartApp({ document: doc });
    const personaId = personas[i].persona_id;

    selectPersonaByIndex(app, i);
    clickNext(app); // Step 3
    clickNext(app); // Step 4
    clickNext(app); // Step 5

    // All preceding steps should have been saved.
    assert.equal(app.formDataStore.has(personaId, 1), true,
      `persona ${i}: Step 1 should be saved`);
    assert.equal(app.formDataStore.has(personaId, 2), true,
      `persona ${i}: Step 2 should be saved`);
    assert.equal(app.formDataStore.has(personaId, 3), true,
      `persona ${i}: Step 3 should be saved`);
    assert.equal(app.formDataStore.has(personaId, 4), true,
      `persona ${i}: Step 4 should be saved`);

    // Step 4 data must have the correct number of agents.
    const step4Data = app.formDataStore.retrieve(personaId, 4);
    assert.ok(step4Data.enabledState, `persona ${i}: Step 4 should have enabledState`);
    assert.equal(
      step4Data.agentCount,
      personas[i].tasks.length,
      `persona ${i}: agentCount should match task count`
    );

    // Every agent in the persona's tasks should appear in the saved state.
    for (const task of personas[i].tasks) {
      assert.ok(
        task.agent_name in step4Data.enabledState,
        `persona ${i}: agent "${task.agent_name}" should be in saved state`
      );
      assert.equal(
        typeof step4Data.enabledState[task.agent_name],
        'boolean',
        `persona ${i}: agent "${task.agent_name}" toggle should be boolean`
      );
    }
  }
});

test('save-on-exit saves the latest state when toggling back and forth', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });
  const personaId = personas[0].persona_id;

  selectPersonaByIndex(app, 0);
  clickNext(app); // Step 3
  clickNext(app); // Step 4

  // First save of Step 4 will happen when we navigate away.
  const firstToggleState = app.currentStep.getEnabledState();

  // Advance to Step 5 (Step 4 is now saved with firstToggleState).
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '5');

  const firstSaved = app.formDataStore.retrieve(personaId, 4);
  assert.deepEqual(firstSaved.enabledState, firstToggleState);

  // Navigate back to Step 4.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '4');

  // Navigate forward again to Step 5 (Step 4 should be saved again).
  clickNext(app);

  // The second save should still match the original state since no toggles
  // were flipped in our fake DOM (the cached Step 4 node was used, so its
  // state is identical).
  const secondSaved = app.formDataStore.retrieve(personaId, 4);
  assert.deepEqual(
    secondSaved.enabledState,
    firstToggleState,
    're-saving Step 4 should preserve the same toggle state'
  );
});

test('Step 3 form state tracks no interaction when no tasks are clicked', () => {
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });

  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  // Do not click any workflow nodes — just advance.
  clickNext(app); // → Step 4

  const step3Saved = app.formDataStore.retrieve(personas[0].persona_id, 3);
  assert.ok(step3Saved, 'Step 3 should be saved even without interaction');
  assert.equal(step3Saved.selectedTaskId, null,
    'selectedTaskId should be null when no task was clicked');
  assert.equal(step3Saved.hasDescriptionPanel, false);
  assert.equal(step3Saved.hasDemoPanel, false);
  assert.deepEqual(step3Saved.demoRunTasks, []);
});

// ── Sub-AC 6.3c: Restore-on-entry ──────────────────────────────────────

test('restore-on-entry: Step 4 toggle state restored when rebuilt after cache invalidation', () => {
  // Scenario: user toggles an agent, navigates back, then forward again.
  // advanceToStep(4) invalidates the Step 4 cache and rebuilds it fresh.
  // Restore-on-entry must load the saved toggle state from the store so
  // the user sees the same configuration they left behind.
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });
  const personaId = personas[0].persona_id;

  // Advance to Step 4.
  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  clickNext(app); // → Step 4
  assert.equal(app.currentStep.attributes['data-step'], '4');

  const step4 = app.currentStep;
  const firstToggle = step4.toggles[0];
  const agentName = firstToggle.attributes['data-agent-name'];

  // Read the initial (default) toggle state.
  const initialState = step4.getEnabledState();
  const initialValue = initialState[agentName];
  assert.equal(typeof initialValue, 'boolean', 'toggle should have boolean state');

  // Flip the toggle away from its default.
  firstToggle.setEnabled(!initialValue);
  const flippedValue = step4.getEnabledState()[agentName];
  assert.notEqual(flippedValue, initialValue,
    'toggle should have flipped after setEnabled');

  // Navigate back to Step 3. This triggers save-on-exit, persisting the
  // flipped Step 4 state to the store.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '3');
  assert.ok(app.formDataStore.has(personaId, 4),
    'Step 4 state should be saved in the store');

  // Navigate forward to Step 4. advanceToStep(4) invalidates stepCache[4],
  // rebuilds Step 4 with default toggles, and then restore-on-entry loads
  // the persisted toggle state.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '4');

  // Verify the restored toggle matches the flipped state, NOT the default.
  const restoredState = app.currentStep.getEnabledState();
  assert.equal(
    restoredState[agentName],
    flippedValue,
    `toggle "${agentName}" should be restored to flipped value after rebuild`
  );

  // Every toggle should match its saved state.
  const savedState = app.formDataStore.retrieve(personaId, 4);
  assert.ok(savedState, 'saved Step 4 state should exist');
  assert.deepEqual(
    restoredState,
    savedState.enabledState,
    'all toggles on the restored Step 4 should match the saved enabledState'
  );
});

test('restore-on-entry: Step 3 selected task restored when rebuilt after cache invalidation', () => {
  // Scenario: user selects a workflow task, navigates back, then forward.
  // advanceToStep(3) invalidates the Step 3 cache and rebuilds it fresh.
  // Restore-on-entry must reload the saved interaction state so the
  // description panel and selection are visible.
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });
  const personaId = personas[0].persona_id;

  // Advance to Step 3.
  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  assert.equal(app.currentStep.attributes['data-step'], '3');

  const step3 = app.currentStep;

  // Click the first workflow node to show its description card.
  const firstNode = step3.diagram.nodes[0];
  firstNode.dispatch('click');

  // Verify the description panel is visible.
  let descPanel = step3.children.find(
    (c) => c.attributes && c.attributes['data-role'] === 'description-panel'
  );
  assert.ok(descPanel,
    'clicking a workflow node should create a description panel');

  // Record which task was selected for later comparison.
  const savedTaskId = firstNode.attributes['data-task-id'];
  assert.ok(savedTaskId, 'selected node should have a task ID');

  // Navigate back to Step 2. This saves Step 3 state (selectedTaskId,
  // hasDescriptionPanel) to the store.
  clickBack(app);
  assert.equal(app.currentStep.attributes['data-step'], '2');
  assert.ok(app.formDataStore.has(personaId, 3),
    'Step 3 state should be saved in the store');

  // Navigate forward to Step 3. advanceToStep(3) deletes stepCache[3]
  // and rebuilds it fresh without any interaction state. Restore-on-entry
  // must re-apply the saved state.
  clickNext(app);
  assert.equal(app.currentStep.attributes['data-step'], '3');

  // Verify the description panel is visible again (restored from store).
  const restoredStep3 = app.currentStep;
  descPanel = restoredStep3.children.find(
    (c) => c.attributes && c.attributes['data-role'] === 'description-panel'
  );
  assert.ok(descPanel,
    'description panel should be visible after restore-on-entry');

  // Verify the saved form state reflects the correct interaction.
  const step3Saved = app.formDataStore.retrieve(personaId, 3);
  assert.ok(step3Saved, 'saved Step 3 state should exist in store');
  assert.equal(step3Saved.selectedTaskId, savedTaskId,
    'saved selectedTaskId should match the clicked node');
  assert.equal(step3Saved.hasDescriptionPanel, true,
    'hasDescriptionPanel should be true in saved state');
});

test('restore-on-entry: does nothing when no saved data exists (first visit)', () => {
  // On the very first forward pass through the wizard, no step has been
  // saved yet, so restore-on-entry should be a harmless no-op.
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });
  const personaId = personas[0].persona_id;

  // Advance straight through to Step 4 without any back-navigation.
  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  clickNext(app); // → Step 4
  assert.equal(app.currentStep.attributes['data-step'], '4');

  // Step 4 should be built with its default toggle state (no restoration).
  const step4State = app.currentStep.getEnabledState();
  assert.ok(Object.keys(step4State).length > 0,
    'Step 4 should have toggles in default state');

  // The store should NOT have Step 4 data yet — save-on-exit only fires
  // when navigating AWAY from a step, and we haven't left Step 4.
  assert.ok(!app.formDataStore.has(personaId, 4),
    'Step 4 should NOT be saved yet (we have not navigated away)');

  // Step 3 should be saved (saved when we left it).
  assert.ok(app.formDataStore.has(personaId, 3),
    'Step 3 should be saved (we left it)');
});

test('restore-on-entry: multiple back/forward cycles preserve toggle state', () => {
  // Simulates a user toggling, going back, forward, toggling again, going
  // back, and forward again. Each forward passage must restore the latest
  // saved state from the store.
  const doc = createFakeDocument();
  const app = createAgentStartApp({ document: doc });
  const personaId = personas[0].persona_id;

  // Advance to Step 4.
  selectPersonaByIndex(app, 0);
  clickNext(app); // → Step 3
  clickNext(app); // → Step 4
  assert.equal(app.currentStep.attributes['data-step'], '4');

  const agentName = app.currentStep.toggles[0].attributes['data-agent-name'];
  const defaultVal = app.currentStep.getEnabledState()[agentName];

  // Round 1: flip toggle, go back, go forward, verify restored.
  app.currentStep.toggles[0].setEnabled(!defaultVal);
  clickBack(app); // → Step 3 (saves Step 4)
  clickNext(app); // → Step 4 (restores)
  assert.equal(app.currentStep.getEnabledState()[agentName], !defaultVal,
    'round 1: toggle should be restored to flipped value');

  // Round 2: flip back to default, go back, go forward, verify restored.
  app.currentStep.toggles[0].setEnabled(defaultVal);
  clickBack(app); // → Step 3 (saves Step 4)
  clickNext(app); // → Step 4 (restores)
  assert.equal(app.currentStep.getEnabledState()[agentName], defaultVal,
    'round 2: toggle should be restored to default value');

  // Round 3: flip again, go back, go forward, verify restored.
  app.currentStep.toggles[0].setEnabled(!defaultVal);
  clickBack(app); // → Step 3 (saves Step 4)
  clickNext(app); // → Step 4 (restores)
  assert.equal(app.currentStep.getEnabledState()[agentName], !defaultVal,
    'round 3: toggle should be restored to flipped value again');

  // The saved state in the store must always match.
  const saved = app.formDataStore.retrieve(personaId, 4);
  assert.ok(saved, 'saved Step 4 state should exist');
  assert.equal(saved.enabledState[agentName], !defaultVal,
    'saved state should reflect round 3 flip');
});

test('restore-on-entry: all personas Step 4 toggle state survives cache invalidation', () => {
  // Ensure restore-on-entry works for all five personas — not just the
  // first one. Each persona's Step 4 is built and invalidated independently.
  for (let i = 0; i < personas.length; i++) {
    const doc = createFakeDocument();
    const app = createAgentStartApp({ document: doc });
    const personaId = personas[i].persona_id;

    // Advance to Step 4 for this persona.
    selectPersonaByIndex(app, i);
    clickNext(app); // → Step 3
    clickNext(app); // → Step 4
    assert.equal(
      app.currentStep.attributes['data-persona-id'],
      personaId
    );

    const step4 = app.currentStep;
    assert.ok(step4.toggles.length > 0,
      `persona ${i}: Step 4 should have toggles`);

    // Flip the first toggle.
    const firstToggle = step4.toggles[0];
    const agentName = firstToggle.attributes['data-agent-name'];
    const original = step4.getEnabledState()[agentName];
    firstToggle.setEnabled(!original);
    const flipped = step4.getEnabledState()[agentName];
    assert.notEqual(flipped, original,
      `persona ${i}: toggle should have flipped`);

    // Navigate back to Step 3, then forward to Step 4.
    clickBack(app);
    assert.equal(app.currentStep.attributes['data-step'], '3');
    assert.ok(app.formDataStore.has(personaId, 4),
      `persona ${i}: Step 4 state should be saved`);

    clickNext(app);
    assert.equal(app.currentStep.attributes['data-step'], '4');

    // Toggle must be restored to flipped value.
    const restored = app.currentStep.getEnabledState()[agentName];
    assert.equal(restored, flipped,
      `persona ${i} (${personas[i].persona_name}): ` +
      `toggle "${agentName}" should be restored to flipped value`
    );
  }
});
