// AgentStart — Step 3: Agent Workflow
//
// Renders the clickable workflow diagram for a persona, an agent description
// card that appears when a task node is clicked, and a simulated agent run
// panel for the 2 demo tasks per persona (10 total across all personas).
//
// Contract:
//   createStep3Workflow({ persona, document, onBack?, onNext? })
//     - persona:  one entry from data/personas (must include tasks array)
//     - document: DOM-like factory; defaults to global document
//     - onBack:   optional callback wired to a "Back" button
//     - onNext:   optional callback wired to a "Next" button
//   Returns the root element.

const { createWorkflowDiagram } = require('../components/WorkflowDiagram');
const { createAgentDescriptionCard } = require('../components/AgentDescriptionCard');
const { taskIdFor } = require('../components/WorkflowDiagram');
const { runSimulatedAgent } = require('../lib/simulatedAgentRun');

function resolveDocument(explicit) {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') return document;
  throw new Error(
    'Step3Workflow: no document provided and no global document'
  );
}

// ── Demo output rendering helper ────────────────────────────────────────
//
// Extracted so both the button click handler and restoreFormState can
// populate the demo output area with the same DOM structure.
function renderSimulatedRunOutput(outputArea, result, doc) {
  while (outputArea.firstChild) {
    outputArea.removeChild(outputArea.firstChild);
  }

  const ctxLabel = doc.createElement('h4');
  ctxLabel.className = 'simulated-run__section-label';
  ctxLabel.textContent = 'Input context';
  outputArea.appendChild(ctxLabel);

  const ctxPre = doc.createElement('pre');
  ctxPre.className = 'simulated-run__json';
  ctxPre.textContent = JSON.stringify(result.context, null, 2);
  outputArea.appendChild(ctxPre);

  const respLabel = doc.createElement('h4');
  respLabel.className = 'simulated-run__section-label';
  respLabel.textContent = 'Agent response';
  outputArea.appendChild(respLabel);

  const respPre = doc.createElement('pre');
  respPre.className = 'simulated-run__json';
  respPre.textContent = JSON.stringify(result.response, null, 2);
  outputArea.appendChild(respPre);
}

function createStep3Workflow({
  persona,
  document: docArg,
  onBack,
  onNext,
} = {}) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('Step3Workflow: `persona` is required');
  }
  if (!Array.isArray(persona.tasks)) {
    throw new Error('Step3Workflow: `persona.tasks` must be an array');
  }
  const doc = resolveDocument(docArg);

  const root = doc.createElement('section');
  root.className = 'step step--workflow';
  root.setAttribute('data-step', '3');
  root.setAttribute('data-persona-id', String(persona.persona_id ?? ''));

  const heading = doc.createElement('h1');
  heading.className = 'step__heading';
  heading.textContent = 'Agent workflow';
  root.appendChild(heading);

  const subheading = doc.createElement('p');
  subheading.className = 'step__subheading';
  subheading.textContent =
    'Click a task to see its agent. Tasks with a demo badge support a simulated agent run.';
  root.appendChild(subheading);

  // Mount the workflow diagram.
  let selectedTaskId = null;
  // Track which tasks have had their simulated agent run triggered so the
  // save-on-exit form state accurately captures demo interaction history.
  const demoRunTasks = new Set();

  function selectTask(task, taskId) {
    selectedTaskId = taskId;

    // Remove any previously shown description card and demo panel.
    if (root.descriptionPanel && root.descriptionPanel.parentNode) {
      root.descriptionPanel.parentNode.removeChild(root.descriptionPanel);
    }
    if (root.demoPanel && root.demoPanel.parentNode) {
      root.demoPanel.parentNode.removeChild(root.demoPanel);
    }

    // Render the agent description card for the clicked task.
    const card = createAgentDescriptionCard({
      persona,
      taskId,
      document: doc,
    });
    card.setAttribute('data-role', 'description-panel');
    root.descriptionPanel = card;
    root.appendChild(card);

    // If the task supports a simulated agent run, add a "Run Demo" button and
    // a panel to display the results.
    if (task.has_demo) {
      const demoPanel = doc.createElement('div');
      demoPanel.className = 'simulated-run';
      demoPanel.setAttribute('data-role', 'demo-panel');

      const demoHeading = doc.createElement('h3');
      demoHeading.className = 'simulated-run__heading';
      demoHeading.textContent = `Simulated agent run: ${task.agent_name}`;
      demoPanel.appendChild(demoHeading);

      const runButton = doc.createElement('button');
      runButton.className = 'simulated-run__trigger';
      runButton.setAttribute('type', 'button');
      runButton.textContent = '▶ Run demo';
      demoPanel.appendChild(runButton);

      const outputArea = doc.createElement('div');
      outputArea.className = 'simulated-run__output';
      outputArea.setAttribute('data-role', 'output');
      demoPanel.appendChild(outputArea);

      runButton.addEventListener('click', () => {
        const result = runSimulatedAgent({
          personaId: persona.persona_id,
          taskId,
        });

        // Track that this task's demo was run.
        demoRunTasks.add(taskId);

        // Render the output using the shared helper.
        renderSimulatedRunOutput(outputArea, result, doc);

        runButton.textContent = '✓ Demo complete';
        runButton.disabled = true;
      });

      // If this task's demo was already run (restored from form state),
      // immediately populate the output and disable the button.
      if (demoRunTasks.has(taskId)) {
        const result = runSimulatedAgent({
          personaId: persona.persona_id,
          taskId,
        });
        renderSimulatedRunOutput(outputArea, result, doc);
        runButton.textContent = '✓ Demo complete';
        runButton.disabled = true;
      }

      root.demoPanel = demoPanel;
      root.appendChild(demoPanel);
    }
  }

  const diagram = createWorkflowDiagram({
    persona,
    onNodeClick: ({ task, taskId }) => selectTask(task, taskId),
    document: doc,
  });
  root.appendChild(diagram);

  // Navigation buttons row.
  const nav = doc.createElement('div');
  nav.className = 'step__nav';

  if (typeof onBack === 'function') {
    const back = doc.createElement('button');
    back.className = 'step__back';
    back.setAttribute('type', 'button');
    back.textContent = '← Back to analysis';
    back.addEventListener('click', () => onBack());
    nav.appendChild(back);
    root.backButton = back;
  }

  if (typeof onNext === 'function') {
    const next = doc.createElement('button');
    next.className = 'step__next step__next--primary';
    next.setAttribute('type', 'button');
    next.textContent = 'Configure agents →';
    next.addEventListener('click', () => onNext());
    nav.appendChild(next);
    root.nextButton = next;
  }

  root.appendChild(nav);

  root.persona = persona;
  root.diagram = diagram;

  // ── Form state for save-on-exit persistence ────────────────────────────
  //
  // Captures the workflow interaction history: which task node is selected,
  // which demos have been run, and whether the description/demo panels are
  // currently visible.
  root.getFormState = () => ({
    selectedTaskId,
    demoRunTasks: Array.from(demoRunTasks),
    hasDescriptionPanel: !!root.descriptionPanel,
    hasDemoPanel: !!root.demoPanel,
  });

  // ── Restore-on-entry (Sub-AC 6.3c) ─────────────────────────────────────
  //
  // When the wizard controller rebuilds this step after cache invalidation,
  // this method re-applies the previously saved interaction state so the
  // user sees the same task selection and demo results they left behind.
  root.restoreFormState = (data) => {
    if (!data) return;

    // Restore demo run tracking.
    if (Array.isArray(data.demoRunTasks)) {
      for (const taskId of data.demoRunTasks) {
        demoRunTasks.add(taskId);
      }
    }

    // Restore selected task — re-triggers description card and demo panel.
    if (data.selectedTaskId) {
      const task = persona.tasks.find(
        (t) => taskIdFor(t) === data.selectedTaskId
      );
      if (task) {
        selectTask(task, data.selectedTaskId);
      }
    }
  };

  return root;
}

module.exports = { createStep3Workflow };
