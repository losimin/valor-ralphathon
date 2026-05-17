// Render tests for TaskBreakdownTable — the sorted task breakdown table
// component with explicit confidence interval columns.
//
// Per Sub-AC 2c-ii we assert:
//   1. Sort order — table rows are ordered by the specified dimension using
//      the canonical sortTasksByDimension from lib/taskSort.js.
//   2. CI rendering — both confidence_interval_low and confidence_interval_high
//      columns are rendered and expose their raw values via data-ci-value.
//   3. Table structure — proper <table> / <thead> / <tbody> / <th> / <tr> / <td>
//      semantics are used.
//   4. Edge cases — input validation throws on invalid args, empty task arrays
//      are handled gracefully.
//   5. Cross-persona smoke — renders for all 5 personas with every valid sort
//      dimension without throwing.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTaskBreakdownTable,
  COLUMNS,
  CI_COLUMN_KEYS,
  DEFAULT_SORT_DIMENSION,
} = require('../TaskBreakdownTable');
const { sortTasksByDimension } = require('../../lib/taskSort');
const { personas } = require('../../data/personas');

// ── Minimal DOM stub (project-wide pattern) ─────────────────────────────────

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

// ── DOM traversal helpers ───────────────────────────────────────────────────

function getThead(table) {
  return table.children.find((c) => c.tagName === 'thead');
}

function getTbody(table) {
  return table.children.find((c) => c.tagName === 'tbody');
}

function getHeaderCells(thead) {
  const headerRow = thead.children[0];
  return headerRow ? headerRow.children : [];
}

function getDataRows(tbody) {
  return tbody ? tbody.children : [];
}

function getCell(row, colKey) {
  return row.children.find(
    (c) => c.attributes && c.attributes['data-col-key'] === colKey
  );
}

// ── Expected sort order helper ──────────────────────────────────────────────

function expectedSortedTaskNames(tasks, dimension) {
  return sortTasksByDimension(tasks, dimension).map((t) => t.task_name);
}

// ── 1. Table structure tests ────────────────────────────────────────────────

test('TaskBreakdownTable renders a <table> element with correct class and testid', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });

  assert.equal(table.tagName, 'table');
  assert.equal(table.className, 'task-breakdown-table');
  assert.equal(table.attributes['data-testid'], 'task-breakdown-table');
});

test('TaskBreakdownTable has <thead> and <tbody> children', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });

  const thead = getThead(table);
  const tbody = getTbody(table);

  assert.ok(thead, 'table must have a <thead>');
  assert.equal(thead.tagName, 'thead');
  assert.equal(thead.className, 'task-breakdown-table__head');

  assert.ok(tbody, 'table must have a <tbody>');
  assert.equal(tbody.tagName, 'tbody');
  assert.equal(tbody.className, 'task-breakdown-table__body');
});

test('TaskBreakdownTable <thead> has header cells matching COLUMNS count and order', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });

  const thead = getThead(table);
  const headerCells = getHeaderCells(thead);

  assert.equal(
    headerCells.length,
    COLUMNS.length,
    `expected ${COLUMNS.length} header cells, got ${headerCells.length}`
  );

  for (let i = 0; i < COLUMNS.length; i++) {
    const th = headerCells[i];
    assert.equal(th.tagName, 'th');
    assert.equal(th.attributes['data-col-key'], COLUMNS[i].key);
    assert.equal(th.textContent, COLUMNS[i].label);
    assert.ok(
      th.className.includes(COLUMNS[i].className),
      `header cell ${i} should have class "${COLUMNS[i].className}"`
    );
  }
});

test('TaskBreakdownTable renders one data row per task', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({ tasks: persona.tasks, document: doc });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    assert.equal(
      rows.length,
      persona.tasks.length,
      `${persona.persona_id}: expected ${persona.tasks.length} rows, got ${rows.length}`
    );
  }
});

test('TaskBreakdownTable data rows have task_name as data attribute', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });
  const tbody = getTbody(table);
  const rows = getDataRows(tbody);

  const taskNames = tasks.map((t) => t.task_name);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    assert.ok(
      taskNames.includes(row.attributes['data-task-name']),
      `row ${i} data-task-name "${row.attributes['data-task-name']}" should be a known task`
    );
    assert.equal(
      row.attributes['data-task-index'],
      String(i),
      `row ${i} data-task-index should be "${i}"`
    );
  }
});

test('TaskBreakdownTable cells have data-col-key matching COLUMNS', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });
  const tbody = getTbody(table);
  const firstRow = getDataRows(tbody)[0];

  assert.equal(firstRow.children.length, COLUMNS.length);

  for (let i = 0; i < COLUMNS.length; i++) {
    const td = firstRow.children[i];
    assert.equal(td.tagName, 'td');
    assert.equal(td.attributes['data-col-key'], COLUMNS[i].key);
  }
});

// ── 2. Sort order tests ────────────────────────────────────────────────────

test('TaskBreakdownTable sorts rows by the specified dimension (task_frequency default)', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });

  // Verify the sort dimension is recorded
  assert.equal(table.attributes['data-sort-dimension'], 'task_frequency');
  assert.equal(table._sortDimension, 'task_frequency');

  // Verify row order matches canonical sort
  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(tasks, 'task_frequency');

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by time_saved_pct descending', () => {
  const persona = personas[1]; // Financial Advisor
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'time_saved_pct',
    document: doc,
  });

  assert.equal(table._sortDimension, 'time_saved_pct');
  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(persona.tasks, 'time_saved_pct');

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by roi_weekly descending', () => {
  const persona = personas[2]; // Teacher
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'roi_weekly',
    document: doc,
  });

  assert.equal(table._sortDimension, 'roi_weekly');
  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(persona.tasks, 'roi_weekly');

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by automation_confidence descending', () => {
  const persona = personas[3]; // Project Manager
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'automation_confidence',
    document: doc,
  });

  assert.equal(table._sortDimension, 'automation_confidence');
  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(
    persona.tasks,
    'automation_confidence'
  );

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by confidence_interval_low descending', () => {
  const persona = personas[4]; // Customer Service Rep
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'confidence_interval_low',
    document: doc,
  });

  assert.equal(table._sortDimension, 'confidence_interval_low');
  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(
    persona.tasks,
    'confidence_interval_low'
  );

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by confidence_interval_high descending', () => {
  const persona = personas[0]; // Editor
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'confidence_interval_high',
    document: doc,
  });

  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(
    persona.tasks,
    'confidence_interval_high'
  );

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by current_hours_weekly descending', () => {
  const persona = personas[1]; // Financial Advisor
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'current_hours_weekly',
    document: doc,
  });

  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(
    persona.tasks,
    'current_hours_weekly'
  );

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by projected_hours_weekly ascending', () => {
  const persona = personas[2]; // Teacher
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'projected_hours_weekly',
    document: doc,
  });

  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(
    persona.tasks,
    'projected_hours_weekly'
  );

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sorts by task_name ascending', () => {
  const persona = personas[3]; // Project Manager
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({
    tasks: persona.tasks,
    sortDimension: 'task_name',
    document: doc,
  });

  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  const actualOrder = rows.map((r) => r.attributes['data-task-name']);
  const expectedOrder = expectedSortedTaskNames(persona.tasks, 'task_name');

  assert.deepEqual(actualOrder, expectedOrder);
});

test('TaskBreakdownTable sort order is stable — same dimension, same order', () => {
  const tasks = personas[0].tasks;
  const doc1 = createFakeDocument();
  const doc2 = createFakeDocument();

  const table1 = createTaskBreakdownTable({
    tasks,
    sortDimension: 'roi_weekly',
    document: doc1,
  });
  const table2 = createTaskBreakdownTable({
    tasks,
    sortDimension: 'roi_weekly',
    document: doc2,
  });

  const order1 = getDataRows(getTbody(table1)).map(
    (r) => r.attributes['data-task-name']
  );
  const order2 = getDataRows(getTbody(table2)).map(
    (r) => r.attributes['data-task-name']
  );

  assert.deepEqual(order1, order2, 'sort order should be deterministic');
});

// ── 3. Confidence interval rendering tests ──────────────────────────────────

test('TaskBreakdownTable renders confidence_interval_low column with data-ci-column marker', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });

  const thead = getThead(table);
  const headerCells = getHeaderCells(thead);

  const ciLowHeader = headerCells.find(
    (th) => th.attributes['data-col-key'] === 'confidence_interval_low'
  );
  assert.ok(ciLowHeader, 'must have a confidence_interval_low header cell');
  assert.equal(
    ciLowHeader.attributes['data-ci-column'],
    'true',
    'CI low header must carry data-ci-column marker'
  );
  assert.ok(
    ciLowHeader.className.includes('col--ci-low'),
    'CI low header must have col--ci-low class'
  );
});

test('TaskBreakdownTable renders confidence_interval_high column with data-ci-column marker', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  const table = createTaskBreakdownTable({ tasks, document: doc });

  const thead = getThead(table);
  const headerCells = getHeaderCells(thead);

  const ciHighHeader = headerCells.find(
    (th) => th.attributes['data-col-key'] === 'confidence_interval_high'
  );
  assert.ok(ciHighHeader, 'must have a confidence_interval_high header cell');
  assert.equal(
    ciHighHeader.attributes['data-ci-column'],
    'true',
    'CI high header must carry data-ci-column marker'
  );
  assert.ok(
    ciHighHeader.className.includes('col--ci-high'),
    'CI high header must have col--ci-high class'
  );
});

test('TaskBreakdownTable CI cells expose raw numeric value via data-ci-value attribute', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    for (const row of rows) {
      const taskName = row.attributes['data-task-name'];
      const task = persona.tasks.find((t) => t.task_name === taskName);
      assert.ok(task, `task "${taskName}" must exist in ${persona.persona_id}`);

      const ciLowCell = getCell(row, 'confidence_interval_low');
      const ciHighCell = getCell(row, 'confidence_interval_high');

      assert.ok(ciLowCell, `row "${taskName}" must have CI low cell`);
      assert.ok(ciHighCell, `row "${taskName}" must have CI high cell`);

      assert.equal(
        ciLowCell.attributes['data-ci-value'],
        String(task.confidence_interval_low),
        `${persona.persona_id} / "${taskName}": CI low data-ci-value mismatch`
      );
      assert.equal(
        ciHighCell.attributes['data-ci-value'],
        String(task.confidence_interval_high),
        `${persona.persona_id} / "${taskName}": CI high data-ci-value mismatch`
      );
    }
  }
});

test('TaskBreakdownTable CI cell text includes the percent sign', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    for (const row of rows) {
      const ciLowCell = getCell(row, 'confidence_interval_low');
      const ciHighCell = getCell(row, 'confidence_interval_high');

      assert.ok(
        ciLowCell.textContent.includes('%'),
        `CI low for "${row.attributes['data-task-name']}" should include %`
      );
      assert.ok(
        ciHighCell.textContent.includes('%'),
        `CI high for "${row.attributes['data-task-name']}" should include %`
      );
    }
  }
});

test('TaskBreakdownTable CI range is valid — low ≤ high for every task', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    for (const row of rows) {
      const ciLow = parseInt(
        getCell(row, 'confidence_interval_low').attributes['data-ci-value'],
        10
      );
      const ciHigh = parseInt(
        getCell(row, 'confidence_interval_high').attributes['data-ci-value'],
        10
      );

      assert.ok(
        ciLow <= ciHigh,
        `${persona.persona_id} / "${row.attributes['data-task-name']}": ` +
          `CI low (${ciLow}) must be ≤ CI high (${ciHigh})`
      );
      assert.ok(
        ciLow >= 0 && ciHigh <= 100,
        `${persona.persona_id} / "${row.attributes['data-task-name']}": ` +
          `CI bounds must be within [0, 100]`
      );
    }
  }
});

// ── 4. Cell content tests ──────────────────────────────────────────────────

test('TaskBreakdownTable renders time_saved_pct values correctly', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    for (const row of rows) {
      const taskName = row.attributes['data-task-name'];
      const task = persona.tasks.find((t) => t.task_name === taskName);
      const cell = getCell(row, 'time_saved_pct');
      assert.equal(
        cell.textContent,
        `${task.time_saved_pct}%`,
        `${persona.persona_id} / "${taskName}" time_saved_pct mismatch`
      );
    }
  }
});

test('TaskBreakdownTable renders roi_weekly with dollar sign and locale formatting', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    for (const row of rows) {
      const cell = getCell(row, 'roi_weekly');
      assert.ok(
        cell.textContent.startsWith('$'),
        `${persona.persona_id} / "${row.attributes['data-task-name']}" ROI should start with $`
      );
    }
  }
});

test('TaskBreakdownTable renders automation_confidence with percent sign', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    for (const row of rows) {
      const taskName = row.attributes['data-task-name'];
      const task = persona.tasks.find((t) => t.task_name === taskName);
      const cell = getCell(row, 'automation_confidence');
      assert.equal(
        cell.textContent,
        `${task.automation_confidence}%`,
        `${persona.persona_id} / "${taskName}" automation_confidence mismatch`
      );
    }
  }
});

test('TaskBreakdownTable renders agent_name for each task', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });
    const tbody = getTbody(table);
    const rows = getDataRows(tbody);

    for (const row of rows) {
      const taskName = row.attributes['data-task-name'];
      const task = persona.tasks.find((t) => t.task_name === taskName);
      const cell = getCell(row, 'agent_name');
      assert.equal(
        cell.textContent,
        task.agent_name,
        `${persona.persona_id} / "${taskName}" agent_name mismatch`
      );
    }
  }
});

// ── 5. Edge case and input validation tests ─────────────────────────────────

test('TaskBreakdownTable throws when tasks is not an array', () => {
  const doc = createFakeDocument();
  assert.throws(
    () => createTaskBreakdownTable({ tasks: null, document: doc }),
    /must be an array/
  );
  assert.throws(
    () => createTaskBreakdownTable({ tasks: {}, document: doc }),
    /must be an array/
  );
  assert.throws(
    () => createTaskBreakdownTable({ document: doc }),
    /must be an array/
  );
});

test('TaskBreakdownTable throws when sortDimension is invalid', () => {
  const doc = createFakeDocument();
  const tasks = personas[0].tasks;
  assert.throws(
    () =>
      createTaskBreakdownTable({
        tasks,
        sortDimension: 'nonexistent',
        document: doc,
      }),
    /unknown dimension/
  );
  assert.throws(
    () =>
      createTaskBreakdownTable({ tasks, sortDimension: '', document: doc }),
    /non-empty string/
  );
  assert.throws(
    () =>
      createTaskBreakdownTable({ tasks, sortDimension: null, document: doc }),
    /non-empty string/
  );
  assert.throws(
    () =>
      createTaskBreakdownTable({ tasks, sortDimension: 123, document: doc }),
    /non-empty string/
  );
});

test('TaskBreakdownTable handles empty task array gracefully', () => {
  const doc = createFakeDocument();
  const table = createTaskBreakdownTable({ tasks: [], document: doc });

  assert.equal(table.tagName, 'table');
  const tbody = getTbody(table);
  const rows = getDataRows(tbody);
  assert.equal(rows.length, 0, 'empty tasks should produce zero data rows');

  // The <thead> should still be present with all column headers
  const thead = getThead(table);
  assert.ok(thead, 'thead must be present even with empty tasks');
  const headerCells = getHeaderCells(thead);
  assert.equal(headerCells.length, COLUMNS.length);
});

test('TaskBreakdownTable _tasks reference holds the correctly sorted array', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      sortDimension: 'roi_monthly',
      document: doc,
    });

    assert.ok(Array.isArray(table._tasks));
    assert.equal(table._tasks.length, persona.tasks.length);

    // Verify the _tasks array is the sorted result
    const expected = sortTasksByDimension(persona.tasks, 'roi_monthly');
    const actualNames = table._tasks.map((t) => t.task_name);
    const expectedNames = expected.map((t) => t.task_name);
    assert.deepEqual(
      actualNames,
      expectedNames,
      `${persona.persona_id}: _tasks should be sorted by roi_monthly`
    );
  }
});

test('TaskBreakdownTable does not mutate the input tasks array', () => {
  for (const persona of personas) {
    const input = persona.tasks;
    const snapshot = input.map((t) => t.task_name);
    const doc = createFakeDocument();

    createTaskBreakdownTable({
      tasks: input,
      sortDimension: 'automation_confidence',
      document: doc,
    });

    // Original order must be preserved
    const after = input.map((t) => t.task_name);
    assert.deepEqual(
      after,
      snapshot,
      `${persona.persona_id}: input tasks array should not be mutated`
    );
  }
});

// ── 6. Cross-persona integration tests ──────────────────────────────────────

test('TaskBreakdownTable renders for all 5 personas with default sort dimension', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      document: doc,
    });

    assert.equal(table.attributes['data-testid'], 'task-breakdown-table');
    assert.ok(getThead(table), `${persona.persona_id}: must have thead`);
    assert.ok(getTbody(table), `${persona.persona_id}: must have tbody`);

    const rows = getDataRows(getTbody(table));
    assert.equal(
      rows.length,
      persona.tasks.length,
      `${persona.persona_id}: row count mismatch`
    );

    // Every data row must have all column cells
    for (const row of rows) {
      assert.equal(
        row.children.length,
        COLUMNS.length,
        `${persona.persona_id} / "${row.attributes['data-task-name']}": cell count mismatch`
      );
    }
  }
});

test('TaskBreakdownTable renders for all personas with every valid sort dimension', () => {
  const validDimensions = [
    'task_frequency',
    'time_saved_pct',
    'current_hours_weekly',
    'projected_hours_weekly',
    'roi_weekly',
    'roi_monthly',
    'automation_confidence',
    'confidence_interval_low',
    'confidence_interval_high',
    'task_name',
  ];

  for (const persona of personas) {
    for (const dim of validDimensions) {
      const doc = createFakeDocument();
      const table = createTaskBreakdownTable({
        tasks: persona.tasks,
        sortDimension: dim,
        document: doc,
      });

      assert.equal(
        table._sortDimension,
        dim,
        `${persona.persona_id}/${dim}: sort dimension mismatch`
      );

      const rows = getDataRows(getTbody(table));
      assert.equal(
        rows.length,
        persona.tasks.length,
        `${persona.persona_id}/${dim}: row count`
      );

      // Verify sort order
      const actualOrder = rows.map((r) => r.attributes['data-task-name']);
      const expectedOrder = expectedSortedTaskNames(persona.tasks, dim);
      assert.deepEqual(
        actualOrder,
        expectedOrder,
        `${persona.persona_id}/${dim}: sort order mismatch`
      );
    }
  }
});

test('TaskBreakdownTable CI columns are present for every persona regardless of sort dimension', () => {
  for (const persona of personas) {
    const doc = createFakeDocument();
    const table = createTaskBreakdownTable({
      tasks: persona.tasks,
      sortDimension: 'roi_weekly', // non-CI dimension
      document: doc,
    });

    const thead = getThead(table);
    const ciHeaders = getHeaderCells(thead).filter(
      (th) => th.attributes['data-ci-column'] === 'true'
    );
    assert.equal(
      ciHeaders.length,
      CI_COLUMN_KEYS.length,
      `${persona.persona_id}: must have ${CI_COLUMN_KEYS.length} CI column headers`
    );

    // Every data row must have CI cells
    const rows = getDataRows(getTbody(table));
    for (const row of rows) {
      for (const ciKey of CI_COLUMN_KEYS) {
        const cell = getCell(row, ciKey);
        assert.ok(
          cell,
          `${persona.persona_id} / "${row.attributes['data-task-name']}": missing CI cell for ${ciKey}`
        );
        assert.ok(
          cell.attributes['data-ci-value'] !== undefined,
          `${persona.persona_id} / "${row.attributes['data-task-name']}": CI cell missing data-ci-value`
        );
      }
    }
  }
});

// ── 7. COLUMNS export integrity ─────────────────────────────────────────────

test('COLUMNS export has required structure with all keyed fields', () => {
  assert.ok(Array.isArray(COLUMNS));
  assert.ok(COLUMNS.length >= 10, 'should have at least 10 columns');

  const keys = COLUMNS.map((c) => c.key);
  for (const ciKey of CI_COLUMN_KEYS) {
    assert.ok(
      keys.includes(ciKey),
      `COLUMNS must include "${ciKey}" column`
    );
  }

  for (const col of COLUMNS) {
    assert.ok(typeof col.key === 'string', `column missing key`);
    assert.ok(typeof col.label === 'string', `column "${col.key}" missing label`);
    assert.ok(
      typeof col.className === 'string',
      `column "${col.key}" missing className`
    );
    assert.ok(
      typeof col.accessor === 'function',
      `column "${col.key}" missing accessor function`
    );
  }
});

test('DEFAULT_SORT_DIMENSION is task_frequency', () => {
  assert.equal(DEFAULT_SORT_DIMENSION, 'task_frequency');
});
