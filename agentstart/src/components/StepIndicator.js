// AgentStart — StepIndicator component
//
// Renders a horizontal wizard progress indicator showing all 5 steps in order
// with their labels. Each step is a button that can be clicked to navigate
// directly to that step (back-navigation only — future steps are disabled).
//
// Step labels:
//   1. Select Role
//   2. Analysis
//   3. Workflow
//   4. Configure
//   5. Complete
//
// Contract:
//   createStepIndicator({ currentStep, maxReachedStep, onStepClick, document })
//     - currentStep:    1–5, the currently active step
//     - maxReachedStep: 1–5, the furthest step the user has legitimately visited
//     - onStepClick:    function(stepIndex) invoked when a reached step is clicked
//     - document:       DOM-like factory; defaults to global document when present
//   Returns the root <nav> element. Each step button exposes:
//     - data-step-index attribute (1–5)
//     - class modifiers: --completed, --active, --future (exactly one per step)
//     - --reached class for backward compatibility (completed + current steps)
//     - disabled attribute for truly unreached steps (i > maxReachedStep)
//
// Sub-AC 6.2.2: Each step item renders visually distinct styling based on its
// status (completed, current, or future). The three primary classes are mutually
// exclusive — every step has exactly one — so CSS rules can independently style
// each state without relying on :not() cascades.
//
// Sub-AC 6.2.3: Clicking a completed/previous step invokes the navigation
// callback with the correct step index; clicking a current or future step
// does not. The component enforces this constraint directly in the click
// handler rather than delegating to the parent.

const STEP_LABELS = [
  'Select Role',
  'Analysis',
  'Workflow',
  'Configure',
  'Complete',
];

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'StepIndicator: no document provided and no global document'
  );
}

function createStepIndicator({
  currentStep = 1,
  maxReachedStep = 1,
  onStepClick,
  document: docArg,
} = {}) {
  if (typeof onStepClick !== 'function') {
    throw new Error('StepIndicator: `onStepClick` must be a function');
  }
  if (
    typeof currentStep !== 'number' ||
    currentStep < 1 ||
    currentStep > 5
  ) {
    throw new Error(
      'StepIndicator: `currentStep` must be a number 1–5'
    );
  }
  if (
    typeof maxReachedStep !== 'number' ||
    maxReachedStep < 1 ||
    maxReachedStep > 5
  ) {
    throw new Error(
      'StepIndicator: `maxReachedStep` must be a number 1–5'
    );
  }

  const doc = resolveDocument(docArg);

  const nav = doc.createElement('nav');
  nav.className = 'step-indicator';
  nav.setAttribute('aria-label', 'Wizard steps');

  // Build one button per step (1–5).
  for (let i = 1; i <= 5; i++) {
    // Three mutually exclusive visual status classes — every step gets
    // exactly one:
    //   --completed  (i < currentStep):  user has passed through this step
    //   --active     (i === currentStep): currently visible step
    //   --future     (i > currentStep):  steps ahead in the wizard flow
    //
    // The disabled state is driven by maxReachedStep independently so
    // previously-visited steps that are "ahead" of current still appear as
    // future but remain clickable for direct back-navigation.
    const isCompleted = i < currentStep;
    const isCurrent = i === currentStep;
    const isFuture = i > currentStep;

    const button = doc.createElement('button');
    button.className = 'step-indicator__step';
    button.setAttribute('type', 'button');
    button.setAttribute('data-step-index', String(i));
    button.setAttribute(
      'aria-label',
      `Step ${i}: ${STEP_LABELS[i - 1]}`
    );

    // Primary status class (exactly one).
    if (isCurrent) {
      button.className += ' step-indicator__step--active';
    }
    if (isCompleted) {
      button.className += ' step-indicator__step--completed';
    }
    if (isFuture) {
      button.className += ' step-indicator__step--future';
    }

    // --reached is applied to completed + current steps for backward
    // compatibility with tests and code that checks reachability.
    if (isCurrent || isCompleted) {
      button.className += ' step-indicator__step--reached';
    }

    // Disabled: only steps beyond maxReachedStep are truly unreachable.
    button.disabled = i > maxReachedStep;

    // Step number circle.
    const number = doc.createElement('span');
    number.className = 'step-indicator__number';
    number.textContent = String(i);
    button.appendChild(number);

    // Step label text.
    const label = doc.createElement('span');
    label.className = 'step-indicator__label';
    label.textContent = STEP_LABELS[i - 1];
    button.appendChild(label);

    // Wire click handler — only fires for completed/previous steps.
    // Sub-AC 6.2.3: clicking a completed/previous step invokes the
    // navigation callback with the correct step index; clicking a
    // current or future step does not. The component enforces this
    // constraint directly rather than relying on the parent.
    button.addEventListener('click', () => {
      if (i < currentStep) {
        onStepClick(i);
      }
    });

    nav.appendChild(button);
  }

  return nav;
}

module.exports = { createStepIndicator, STEP_LABELS };
