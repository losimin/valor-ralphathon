// Unit tests for the StepIndicator component.
//
// Sub-AC 6.2.1: StepIndicator component renders all wizard steps in correct
// order with their labels.
//
// These tests cover:
//   1. Rendering 5 steps in order (1–5) with correct labels.
//   2. Active/reached/future state classes on each step button.
//   3. Click handler is wired and receives the correct step index.
//   4. Future steps are disabled; reached steps are not.
//   5. Validation: throws on missing or invalid arguments.
//   6. Re-rendering: calling createStepIndicator with updated props
//      produces the correct active/reached/future states.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStepIndicator, STEP_LABELS } = require('../StepIndicator');

// ── Lightweight DOM stub ──────────────────────────────────────────────────

function createFakeDocument() {
  function makeNode(tagName) {
    const listeners = {};
    return {
      tagName,
      children: [],
      attributes: {},
      className: '',
      textContent: '',
      disabled: false,
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

// Helper: find a step button by index.
function findStep(indicator, n) {
  for (const child of indicator.children) {
    if (Number(child.attributes['data-step-index']) === n) return child;
  }
  return null;
}

// ── Rendering ─────────────────────────────────────────────────────────────

test('StepIndicator renders exactly 5 step buttons', () => {
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 1,
    maxReachedStep: 1,
    onStepClick: () => {},
    document: doc,
  });

  assert.equal(indicator.children.length, 5);
  assert.equal(indicator.className, 'step-indicator');
  assert.equal(indicator.attributes['aria-label'], 'Wizard steps');
});

test('StepIndicator renders steps 1–5 with correct labels in order', () => {
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 1,
    maxReachedStep: 1,
    onStepClick: () => {},
    document: doc,
  });

  for (let i = 1; i <= 5; i++) {
    const step = findStep(indicator, i);
    assert.ok(step, `Step ${i} button should exist`);

    // Each step has a number span and a label span.
    assert.equal(step.children.length, 2, `Step ${i} should have 2 children (number + label)`);

    const numberSpan = step.children[0];
    const labelSpan = step.children[1];

    assert.equal(numberSpan.className, 'step-indicator__number');
    assert.equal(numberSpan.textContent, String(i));

    assert.equal(labelSpan.className, 'step-indicator__label');
    assert.equal(labelSpan.textContent, STEP_LABELS[i - 1]);
  }
});

test('StepIndicator renders labels matching expected wizard step names', () => {
  // Verify the canonical step names.
  assert.deepEqual(STEP_LABELS, [
    'Select Role',
    'Analysis',
    'Workflow',
    'Configure',
    'Complete',
  ]);
});

test('each step button has correct tag, type, and data-step-index', () => {
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 1,
    maxReachedStep: 1,
    onStepClick: () => {},
    document: doc,
  });

  for (let i = 1; i <= 5; i++) {
    const step = findStep(indicator, i);
    assert.equal(step.tagName, 'button');
    assert.equal(step.attributes['type'], 'button');
    assert.equal(step.attributes['data-step-index'], String(i));
    assert.ok(
      step.attributes['aria-label'].includes(STEP_LABELS[i - 1]),
      `aria-label should include step label "${STEP_LABELS[i - 1]}"`
    );
  }
});

// ── Active / Completed / Future state ─────────────────────────────────────
//
// Sub-AC 6.2.2: Each step item renders visually distinct styling based on
// its status (completed, current, or future). These tests verify the three
// mutually exclusive primary status classes:
//   --completed  (i < currentStep)
//   --active     (i === currentStep)
//   --future     (i > maxReachedStep)
//
// The --reached class is applied to both completed and current steps.

test('step 1 is active when currentStep=1; steps 2–5 are future; no completed steps', () => {
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 1,
    maxReachedStep: 1,
    onStepClick: () => {},
    document: doc,
  });

  const step1 = findStep(indicator, 1);
  assert.match(step1.className, /step-indicator__step--active/,
    'Step 1 should have --active class');
  assert.match(step1.className, /step-indicator__step--reached/,
    'Step 1 should have --reached class');
  assert.ok(!step1.className.includes('step-indicator__step--completed'),
    'Step 1 should NOT have --completed class (it is current, not completed)');
  assert.ok(!step1.className.includes('step-indicator__step--future'),
    'Step 1 should NOT have --future class');

  for (let i = 2; i <= 5; i++) {
    const step = findStep(indicator, i);
    assert.ok(
      !step.className.includes('step-indicator__step--active'),
      `Step ${i} should NOT have --active class`
    );
    assert.ok(
      !step.className.includes('step-indicator__step--completed'),
      `Step ${i} should NOT have --completed class (unreached)`
    );
    assert.match(step.className, /step-indicator__step--future/,
      `Step ${i} should have --future class`);
  }
});

test('steps < currentStep get --completed; current step gets --active; steps > maxReachedStep get --future', () => {
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 3,
    maxReachedStep: 3,
    onStepClick: () => {},
    document: doc,
  });

  // Steps 1–2 should be --completed and --reached.
  for (let i = 1; i <= 2; i++) {
    const step = findStep(indicator, i);
    assert.match(step.className, /step-indicator__step--completed/,
      `Step ${i} should have --completed class`);
    assert.match(step.className, /step-indicator__step--reached/,
      `Step ${i} should have --reached class`);
    assert.ok(!step.className.includes('step-indicator__step--active'),
      `Step ${i} should NOT have --active class`);
    assert.ok(!step.className.includes('step-indicator__step--future'),
      `Step ${i} should NOT have --future class`);
  }

  // Step 3 should be --active and --reached, not --completed.
  const step3 = findStep(indicator, 3);
  assert.match(step3.className, /step-indicator__step--active/);
  assert.match(step3.className, /step-indicator__step--reached/);
  assert.ok(!step3.className.includes('step-indicator__step--completed'),
    'Current step should NOT have --completed class');
  assert.ok(!step3.className.includes('step-indicator__step--future'),
    'Current step should NOT have --future class');

  // Steps 4–5 should be --future.
  for (let i = 4; i <= 5; i++) {
    const step = findStep(indicator, i);
    assert.match(step.className, /step-indicator__step--future/,
      `Step ${i} should have --future class`);
    assert.ok(!step.className.includes('step-indicator__step--reached'),
      `Step ${i} should NOT have --reached class`);
    assert.ok(!step.className.includes('step-indicator__step--completed'),
      `Step ${i} should NOT have --completed class`);
    assert.ok(!step.className.includes('step-indicator__step--active'),
      `Step ${i} should NOT have --active class`);
  }
});

test('--completed, --active, and --future are mutually exclusive per step', () => {
  // Scrub every combination of currentStep in [1..5] with maxReachedStep ==
  // currentStep and confirm that every step button has at most one of the
  // three primary status classes.
  for (let cs = 1; cs <= 5; cs++) {
    const doc = createFakeDocument();
    const indicator = createStepIndicator({
      currentStep: cs,
      maxReachedStep: cs,
      onStepClick: () => {},
      document: doc,
    });

    for (let i = 1; i <= 5; i++) {
      const step = findStep(indicator, i);
      const hasCompleted = step.className.includes('step-indicator__step--completed');
      const hasActive = step.className.includes('step-indicator__step--active');
      const hasFuture = step.className.includes('step-indicator__step--future');

      const count = (hasCompleted ? 1 : 0) + (hasActive ? 1 : 0) + (hasFuture ? 1 : 0);
      assert.equal(
        count,
        1,
        `currentStep=${cs} step ${i}: must have exactly one of --completed, --active, --future, got ${count}`
      );
    }
  }
});

test('when all 5 steps are reached, steps 1–4 have --completed and step 5 has --active', () => {
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 5,
    maxReachedStep: 5,
    onStepClick: () => {},
    document: doc,
  });

  // Steps 1–4 should be --completed.
  for (let i = 1; i <= 4; i++) {
    const step = findStep(indicator, i);
    assert.match(step.className, /step-indicator__step--reached/,
      `Step ${i} should have --reached class`);
    assert.match(step.className, /step-indicator__step--completed/,
      `Step ${i} should have --completed class`);
    assert.ok(!step.className.includes('step-indicator__step--active'),
      `Step ${i} should NOT have --active class`);
    assert.ok(!step.className.includes('step-indicator__step--future'),
      `Step ${i} should NOT have --future class`);
  }

  // Step 5 should be --active, not --completed.
  const step5 = findStep(indicator, 5);
  assert.match(step5.className, /step-indicator__step--active/);
  assert.match(step5.className, /step-indicator__step--reached/);
  assert.ok(!step5.className.includes('step-indicator__step--completed'),
    'Step 5 should NOT have --completed class');
  assert.ok(!step5.className.includes('step-indicator__step--future'),
    'Step 5 should NOT have --future class');
});

test('when maxReachedStep > currentStep, steps between current and maxReached are --future (visited but not completed)', () => {
  // Scenario: user advanced to step 4 (maxReachedStep=4) then navigated back
  // to step 2 (currentStep=2). Steps 3–4 were previously visited but are not
  // "completed" in the forward-progression sense.
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 2,
    maxReachedStep: 4,
    onStepClick: () => {},
    document: doc,
  });

  // Step 1: completed (i < currentStep, 1 < 2)
  const step1 = findStep(indicator, 1);
  assert.match(step1.className, /step-indicator__step--completed/);
  assert.match(step1.className, /step-indicator__step--reached/);
  assert.ok(!step1.disabled);

  // Step 2: current (i === currentStep)
  const step2 = findStep(indicator, 2);
  assert.match(step2.className, /step-indicator__step--active/);
  assert.match(step2.className, /step-indicator__step--reached/);
  assert.ok(!step2.className.includes('step-indicator__step--completed'));
  assert.ok(!step2.disabled);

  // Step 3–4: reached but future relative to current position
  for (let i = 3; i <= 4; i++) {
    const step = findStep(indicator, i);
    assert.ok(
      !step.className.includes('step-indicator__step--completed'),
      `Step ${i} should NOT have --completed`
    );
    assert.ok(
      !step.className.includes('step-indicator__step--active'),
      `Step ${i} should NOT have --active`
    );
    assert.ok(
      step.className.includes('step-indicator__step--future') ||
      step.className.includes('step-indicator__step--reached'),
      `Step ${i} should have --future or --reached`
    );
    // These are reached (i <= maxReachedStep), so NOT disabled.
    assert.ok(!step.disabled,
      `Step ${i} should NOT be disabled (already reached)`);
  }

  // Step 5: truly unreached
  const step5 = findStep(indicator, 5);
  assert.match(step5.className, /step-indicator__step--future/);
  assert.ok(step5.disabled);
});

// ── Disabled state ────────────────────────────────────────────────────────

test('future steps are disabled; reached steps are not', () => {
  const doc = createFakeDocument();
  const indicator = createStepIndicator({
    currentStep: 2,
    maxReachedStep: 3,
    onStepClick: () => {},
    document: doc,
  });

  // Steps 1–3 should NOT be disabled.
  for (let i = 1; i <= 3; i++) {
    const step = findStep(indicator, i);
    assert.ok(!step.disabled, `Step ${i} should NOT be disabled`);
  }
  // Steps 4–5 should be disabled.
  for (let i = 4; i <= 5; i++) {
    const step = findStep(indicator, i);
    assert.ok(step.disabled, `Step ${i} should be disabled`);
  }
});

// ── Click handler ─────────────────────────────────────────────────────────

test('clicking a reached step invokes onStepClick with correct index', () => {
  const doc = createFakeDocument();
  const clicks = [];
  const indicator = createStepIndicator({
    currentStep: 4,
    maxReachedStep: 4,
    onStepClick: (n) => clicks.push(n),
    document: doc,
  });

  // Click Step 2 (reached).
  findStep(indicator, 2).dispatch('click');
  assert.deepEqual(clicks, [2]);

  // Click Step 1 (reached).
  findStep(indicator, 1).dispatch('click');
  assert.deepEqual(clicks, [2, 1]);

  // Click Step 3 (reached).
  findStep(indicator, 3).dispatch('click');
  assert.deepEqual(clicks, [2, 1, 3]);
});

test('clicking a current or future step does NOT fire onStepClick', () => {
  // Sub-AC 6.2.3: The StepIndicator component only fires onStepClick for
  // completed/previous steps (i < currentStep). Current and future steps
  // are no-ops — the component enforces this constraint directly.
  const doc = createFakeDocument();
  const clicks = [];
  const indicator = createStepIndicator({
    currentStep: 3,
    maxReachedStep: 5,
    onStepClick: (n) => clicks.push(n),
    document: doc,
  });

  // Click current Step 3 — should NOT fire.
  findStep(indicator, 3).dispatch('click');
  assert.deepEqual(clicks, [],
    'clicking current step should not fire onStepClick');

  // Click future Step 4 (reached but not completed) — should NOT fire.
  findStep(indicator, 4).dispatch('click');
  assert.deepEqual(clicks, [],
    'clicking future step should not fire onStepClick');

  // Click future Step 5 (reached but not completed) — should NOT fire.
  findStep(indicator, 5).dispatch('click');
  assert.deepEqual(clicks, [],
    'clicking future step should not fire onStepClick');
});

test('clicking a completed step invokes onStepClick with correct step index', () => {
  // Sub-AC 6.2.3: Only completed (i < currentStep) steps trigger the callback.
  const doc = createFakeDocument();
  const clicks = [];
  const indicator = createStepIndicator({
    currentStep: 4,
    maxReachedStep: 5,
    onStepClick: (n) => clicks.push(n),
    document: doc,
  });

  // Click completed Step 2.
  findStep(indicator, 2).dispatch('click');
  assert.deepEqual(clicks, [2]);

  // Click completed Step 1.
  findStep(indicator, 1).dispatch('click');
  assert.deepEqual(clicks, [2, 1]);

  // Click completed Step 3.
  findStep(indicator, 3).dispatch('click');
  assert.deepEqual(clicks, [2, 1, 3]);

  // Current Step 4 should NOT fire.
  findStep(indicator, 4).dispatch('click');
  assert.deepEqual(clicks, [2, 1, 3],
    'current step should not fire onStepClick');

  // Future Step 5 should NOT fire.
  findStep(indicator, 5).dispatch('click');
  assert.deepEqual(clicks, [2, 1, 3],
    'future step should not fire onStepClick');
});

test('re-rendering with new currentStep updates active and completed classes correctly', () => {
  const doc = createFakeDocument();

  // Start at step 1, reached step 2.
  let indicator = createStepIndicator({
    currentStep: 1,
    maxReachedStep: 2,
    onStepClick: () => {},
    document: doc,
  });

  assert.match(findStep(indicator, 1).className, /--active/);
  assert.match(findStep(indicator, 1).className, /--reached/);
  assert.ok(!findStep(indicator, 1).className.includes('--completed'));
  assert.match(findStep(indicator, 2).className, /--future/);
  assert.ok(!findStep(indicator, 2).disabled,
    'Step 2 is reached (maxReachedStep=2) so should NOT be disabled');

  // Re-render: now at step 2, reached step 3.
  indicator = createStepIndicator({
    currentStep: 2,
    maxReachedStep: 3,
    onStepClick: () => {},
    document: doc,
  });

  // Step 1: completed.
  assert.match(findStep(indicator, 1).className, /--completed/);
  assert.match(findStep(indicator, 1).className, /--reached/);
  assert.ok(!findStep(indicator, 1).className.includes('--active'));

  // Step 2: current.
  assert.match(findStep(indicator, 2).className, /--active/);
  assert.match(findStep(indicator, 2).className, /--reached/);
  assert.ok(!findStep(indicator, 2).className.includes('--completed'));

  // Step 3: future but reached (clickable).
  assert.match(findStep(indicator, 3).className, /--future/);
  assert.ok(!findStep(indicator, 3).disabled,
    'Step 3 is reached (maxReachedStep=3) so should NOT be disabled');

  // Steps 4–5: future and unreached.
  assert.match(findStep(indicator, 4).className, /--future/);
  assert.ok(findStep(indicator, 4).disabled);
  assert.match(findStep(indicator, 5).className, /--future/);
  assert.ok(findStep(indicator, 5).disabled);
});

// ── Validation ────────────────────────────────────────────────────────────

test('throws if onStepClick is not a function', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createStepIndicator({ currentStep: 1, maxReachedStep: 1, document: doc }),
    /onStepClick/
  );
  assert.throws(
    () =>
      createStepIndicator({
        currentStep: 1,
        maxReachedStep: 1,
        onStepClick: 'not-a-function',
        document: doc,
      }),
    /onStepClick/
  );
});

test('throws if currentStep is out of range', () => {
  const doc = createFakeDocument();
  const noop = () => {};

  assert.throws(
    () =>
      createStepIndicator({
        currentStep: 0,
        maxReachedStep: 1,
        onStepClick: noop,
        document: doc,
      }),
    /currentStep/
  );
  assert.throws(
    () =>
      createStepIndicator({
        currentStep: 6,
        maxReachedStep: 1,
        onStepClick: noop,
        document: doc,
      }),
    /currentStep/
  );
});

test('throws if maxReachedStep is out of range', () => {
  const doc = createFakeDocument();
  const noop = () => {};

  assert.throws(
    () =>
      createStepIndicator({
        currentStep: 1,
        maxReachedStep: 0,
        onStepClick: noop,
        document: doc,
      }),
    /maxReachedStep/
  );
  assert.throws(
    () =>
      createStepIndicator({
        currentStep: 1,
        maxReachedStep: 6,
        onStepClick: noop,
        document: doc,
      }),
    /maxReachedStep/
  );
});

test('uses global document when document arg is omitted', () => {
  // This test only runs when a global document exists (browser or jsdom).
  if (typeof document === 'undefined') return;

  const indicator = createStepIndicator({
    currentStep: 1,
    maxReachedStep: 1,
    onStepClick: () => {},
  });

  assert.ok(indicator);
  assert.equal(indicator.children.length, 5);
});
