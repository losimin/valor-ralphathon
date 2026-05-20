const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTaskBreakdownTable,
  COLUMNS,
  DEFAULT_MAX_ROWS,
  SOURCE_NOTE,
} = require('../TaskBreakdownTable');
const { sortTasksByDimension } = require('../../lib/taskSort');
const {
  taskExposureToLlm,
  taskProjectedHoursSavedWeekly,
  taskRoiMonthlyFromProjectedHours,
} = require('../../lib/kpi');
const { personas } = require('../../data/personas');

function createFakeDocument() {
  function makeNode(tagName) {
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
    };
  }
  return { createElement: (tag) => makeNode(tag) };
}

function getTbody(table) {
  return table.children.find((c) => c.tagName === 'tbody');
}

function getThead(table) {
  return table.children.find((c) => c.tagName === 'thead');
}

function getTfoot(table) {
  return table.children.find((c) => c.tagName === 'tfoot');
}

function getCell(row, key) {
  return row.children.find((c) => c.attributes['data-col-key'] === key);
}

function getDetails(cell) {
  return cell.children.find((c) => c.tagName === 'details');
}

test('TaskBreakdownTable renders the requested five columns in order', () => {
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: personas[0].tasks,
    hourlyRate: personas[0].hourly_rate,
    document: doc,
  });

  const headers = getThead(table).children[0].children;
  assert.deepEqual(
    headers.map((header) => header.attributes['data-col-key']),
    COLUMNS.map((column) => column.key)
  );
  assert.deepEqual(
    headers.map((header) => header.textContent),
    [
      'Tasks',
      'Exposure to LLM',
      'Hours saved / week',
      'ROI / month',
      'Agent',
    ]
  );
});

test('TaskBreakdownTable orders by frequency and caps rows at five', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      hourlyRate: persona.hourly_rate,
      rateDetail: persona.rate_detail,
      document: doc,
    });

    const expected = sortTasksByDimension(persona.tasks, 'task_frequency')
      .slice(0, DEFAULT_MAX_ROWS)
      .map((task) => task.task_name);
    const actual = getTbody(table).children.map(
      (row) => row.attributes['data-task-name']
    );

    assert.deepEqual(actual, expected, persona.persona_id);
    assert.ok(actual.length <= 5);
  }
});

test('TaskBreakdownTable renders AEI exposure, projected hours, monthly ROI, and agent', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    hourlyRate: persona.hourly_rate,
    rateDetail: persona.rate_detail,
    document: doc,
  });

  for (const row of getTbody(table).children) {
    const task = persona.tasks.find(
      (t) => t.task_name === row.attributes['data-task-name']
    );
    assert.equal(getCell(row, 'exposure_to_llm').textContent, taskExposureToLlm(task));
    assert.equal(
      getDetails(getCell(row, 'projected_hours_saved_weekly')).children[0].textContent,
      `${Number(taskProjectedHoursSavedWeekly(task, persona.tasks).toFixed(1))}h`
    );
    assert.equal(
      getDetails(getCell(row, 'roi_monthly_projected')).children[0].textContent,
      `$${taskRoiMonthlyFromProjectedHours(
        task,
        persona.hourly_rate,
        persona.tasks
      ).toLocaleString()}`
    );
    assert.match(
      getDetails(getCell(row, 'roi_monthly_projected')).children[1].textContent,
      /mean annual wage|Hourly rate input/
    );
    assert.equal(getCell(row, 'agent_name').textContent, task.agent_name);
  }
});

test('TaskBreakdownTable renders source citations in the footer', () => {
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: personas[0].tasks,
    hourlyRate: personas[0].hourly_rate,
    document: doc,
  });
  const sourceCell = getTfoot(table).children[1].children[0];

  assert.equal(sourceCell.attributes.colspan, String(COLUMNS.length));
  assert.equal(sourceCell.textContent, SOURCE_NOTE);
  assert.match(sourceCell.textContent, /O\*NET/);
  assert.match(sourceCell.textContent, /Anthropic Economic Index/);
  assert.match(sourceCell.textContent, /BLS OEWS/);
});

test('TaskBreakdownTable renders a total row for hours saved and ROI/month', () => {
  const persona = personas[0];
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    hourlyRate: persona.hourly_rate,
    rateDetail: persona.rate_detail,
    document: doc,
  });
  const totalRow = getTfoot(table).children[0];

  assert.equal(totalRow.className, 'task-breakdown-table__total-row');
  assert.equal(getCell(totalRow, 'task_name').textContent, 'Total');
  assert.match(getCell(totalRow, 'projected_hours_saved_weekly').textContent, /h$/);
  assert.match(getCell(totalRow, 'roi_monthly_projected').textContent, /^\$/);
});

test('TaskBreakdownTable validates task input', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createTaskBreakdownTable({ tasks: null, document: doc }),
    /tasks/
  );
});
