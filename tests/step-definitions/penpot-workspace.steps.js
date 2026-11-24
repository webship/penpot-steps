'use strict';

// The workspace: a file and its pages, the drawing tools, the layers (made,
// selected, renamed, grouped, deleted, made components and variants), the
// Design values of a selection, the tabs of the side bars, the main menu,
// the assets and the shared libraries, and the other people in the file.

const { Given, When, Then } = require('@cucumber/cucumber');
const crypto = require('crypto');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/** The pages of the file: [{ name, id, open }]. */
async function pages(page) {
  return page.locator('[data-testid^="page-"]').evaluateAll((items) => items
    .filter((e) => e.getAttribute('data-testid') !== 'page-name' && e.querySelector('[data-testid="page-name"]'))
    .map((e) => ({ name: (e.querySelector('[data-testid="page-name"]').innerText || '').trim(), id: e.getAttribute('data-testid').replace(/^page-/, ''), open: /selected/.test(String(e.className)) }))).catch(() => []);
}

/** A page's item in the side bar by its name. */
function pageItem(page, name) {
  return page.locator('[data-testid^="page-"]').filter({ has: page.getByTestId('page-name').filter({ hasText: h.exactly(name) }) }).first();
}

/** Wait for a layer named like the tool to be selected after a drawing; return its name. */
async function waitDrawn(world, before, tool, what) {
  const page = world.page;
  const now = await h.waitNewLayer(world, before, what);
  const fresh = now.filter((l) => !before.some((b) => b.id === l.id));
  const named = fresh.find((l) => !tool.layer || h.normal(l.name) === h.normal(tool.layer)) || fresh[0];
  return named ? named.name : '';
}

/** Draw with a tool from a point of the screen by a size; the layer it made is selected. */
async function drawAt(world, toolName, from, width, height) {
  const page = world.page;
  const before = await h.layers(page);
  const tool = await h.chooseTool(world, toolName);
  await h.dragOnCanvas(page, from, width, height);
  return waitDrawn(world, before, tool, `the ${toolName} was drawn`);
}

/** Write a text with the text tool, in a box dragged from a point; the text layer is named by its words. */
async function writeAt(world, words, from) {
  const page = world.page;
  const before = await h.layers(page);
  await h.chooseTool(world, 'Text');
  await h.dragOnCanvas(page, from, 180, 30);
  const editor = page.locator('[contenteditable="true"]').filter({ visible: true }).first();
  try {
    await editor.waitFor({ state: 'visible', timeout: h.budget(world) });
  } catch (err) {
    throw friendly({ message: 'The text tool opened no editor on the canvas.', cause: err, hint: 'The text tool needs a drag over an empty part of the canvas.' });
  }
  await page.keyboard.type(words);
  await page.keyboard.press('Escape');
  await h.waitNewLayer(world, before, `the text "${words}" was written`);
  await h.eventually(page, () => h.layers(page), (rows) => rows.some((l) => h.normal(l.name) === h.normal(words)), async (rows) => ({
    message: `No layer "${words}" came of the text. The layers: ${h.listed(rows.map((l) => l.name))}.`,
    hint: 'A text layer is named by its words.',
  }), h.budget(world));
}

/** The point to start a drawing inside a board: 20 px in from its top left corner, with the size that fits. */
async function insideBoard(world, board, width, height) {
  const box = await h.shapeBox(world, board);
  return { from: { x: box.x + 20, y: box.y + 20 }, width: Math.max(20, Math.min(width, box.width - 40)), height: Math.max(20, Math.min(height, box.height - 40)) };
}

/**
 * Open a file in the workspace by its name, as the logged in account (any team it is in).
 *
 * Example #1: When I open the file "Homepage"
 * Example #2: When we open the file "Webship test file"
 * Example #3: And I open the file "Style guide"
 * Example #4: Given I open the file "Homepage"
 * Example #5: When I open the file "Pricing page"
 */
When(/^(?:I|we) open the file "([^"]*)"$/, { timeout: 120000 }, async function (name) {
  await h.openFile(this, name);
});

/**
 * Open a file in the workspace at an address whose page does not exist: the workspace opens its first page and puts
 * that page in the address.
 *
 * Example #1: When I open the file "Homepage" at a page that does not exist
 * Example #2: When we open the file "Webship test file" at a page that does not exist
 * Example #3: And I open the file "Homepage" at a page that does not exist
 * Example #4: When I open the file "Pricing page" at a page that does not exist
 * Example #5: When I open the file "Style guide" at a page that does not exist
 */
When(/^(?:I|we) open the file "([^"]*)" at a page that does not exist$/, { timeout: 120000 }, async function (name) {
  await h.openFile(this, name, { pageId: crypto.randomUUID() });
});

/**
 * Assert the page of the file the workspace shows (the item of the side bar that is open), and that the address
 * names it.
 *
 * Example #1: Then the open page should be "Page 1"
 * Example #2: Then the open page should be "Webship test page"
 * Example #3: And the open page should be "Page 2"
 * Example #4: Then the open page should be "Page 1"
 * Example #5: Then the open page should be "Webship test page"
 */
Then(/^the open page should be "([^"]*)"$/, async function (name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.eventually(page, async () => ({ list: await pages(page), id: new URL(page.url()).searchParams.get('page-id') }), (v) => {
    const open = v.list.find((p) => p.open);
    return !!open && h.normal(open.name) === h.normal(name) && open.id === v.id;
  }, async (v) => {
    const open = v.list.find((p) => p.open);
    return {
      message: open ? `The open page is "${open.name}"${open.id !== v.id ? ` and the address names the page ${v.id}` : ''}, not "${name}".` : `No page is open. The pages: ${h.listed(v.list.map((p) => p.name))}.`,
      hint: 'A page opens with a click on its name in the side bar; the address carries its id.',
    };
  }, h.budget(this) * 2);
});

/**
 * Assert that the file's pages list a page, or do not.
 *
 * Example #1: Then the pages should list "Page 1"
 * Example #2: Then the pages should not list "Page 2"
 * Example #3: And the pages should list "Webship test page"
 * Example #4: Then the pages should list "Page 2"
 * Example #5: But the pages should not list "Webship test page"
 */
Then(/^the pages should( not)? list "([^"]*)"$/, async function (notCase, name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.eventually(page, () => pages(page), (list) => list.some((p) => h.normal(p.name) === h.normal(name)) === !notCase, async (list) => ({
    message: `The pages ${notCase ? 'list' : 'do not list'} "${name}". They are ${h.listed(list.map((p) => p.name))}.`,
    hint: 'The pages are at the top of the Layers tab.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Add a page to the file ("Add page") and open it.
 *
 * Example #1: When I add a page
 * Example #2: When we add a page
 * Example #3: And I add a page
 * Example #4: Then I add a page
 * Example #5: When I add a page
 */
When(/^(?:I|we) add a page$/, { timeout: 60000 }, async function () {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  const before = await pages(page);
  await page.getByRole('button', { name: 'Add page' }).click();
  const now = await h.eventually(page, () => pages(page), (list) => list.length > before.length, async (list) => ({ message: `No page was added. The pages: ${h.listed(list.map((p) => p.name))}.`, hint: 'A viewer cannot add a page.' }), h.budget(this));
  const added = now.find((p) => !before.some((b) => b.id === p.id));
  if (added && !added.open) {
    await pageItem(page, added.name).click();
    await page.waitForURL((url) => url.searchParams.get('page-id') === added.id, { timeout: h.budget(this) }).catch(() => {});
  }
  await h.settle(page, h.budget(this));
});

/**
 * Open a page of the file by its name.
 *
 * Example #1: When I open the page "Page 1"
 * Example #2: When we open the page "Webship test page"
 * Example #3: And I open the page "Page 2"
 * Example #4: When I open the page "Page 1"
 * Example #5: When I open the page "Webship test page"
 */
When(/^(?:I|we) open the page "([^"]*)"$/, { timeout: 60000 }, async function (name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  const list = await pages(page);
  const target = list.find((p) => h.normal(p.name) === h.normal(name));
  if (!target) throw friendly({ message: `The file has no page "${name}". Its pages: ${h.listed(list.map((p) => p.name))}.`, hint: 'Add a page first (When I add a page).' });
  await pageItem(page, name).click();
  await page.waitForURL((url) => url.searchParams.get('page-id') === target.id, { timeout: h.budget(this) }).catch(() => {});
  await h.settle(page, h.budget(this));
});

/**
 * Rename a page: a double click on its name, the new name typed in place of the old one, Enter.
 *
 * Example #1: When I rename the page "Page 2" to "Webship test page"
 * Example #2: When we rename the page "Page 1" to "Webship test page"
 * Example #3: And I rename the page "Webship test page" to "Page 2"
 * Example #4: When I rename the page "Page 2" to "Webship test second page"
 * Example #5: When I rename the page "Webship test page" to "Webship test renamed page"
 */
When(/^(?:I|we) rename the page "([^"]*)" to "([^"]*)"$/, { timeout: 60000 }, async function (from, to) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  const item = pageItem(page, from);
  if (!(await item.count())) throw friendly({ message: `The file has no page "${from}". Its pages: ${h.listed((await pages(page)).map((p) => p.name))}.`, hint: 'Name the page as the side bar shows it.' });
  await item.getByTestId('page-name').dblclick();
  const input = page.locator('input[class*="page-item-input"]').first();
  await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  await input.fill(to);
  await input.press('Enter');
  await h.eventually(page, () => pages(page), (list) => list.some((p) => h.normal(p.name) === h.normal(to)), async (list) => ({ message: `The page was not renamed. The pages: ${h.listed(list.map((p) => p.name))}.`, hint: 'Enter saves the new name.' }), h.budget(this));
});

/**
 * Draw a shape on an empty part of the canvas with a tool of the toolbar: "Board", "Rectangle" or "Ellipse" (the
 * ellipse sits in the flyout of the rectangle). The new layer is selected.
 *
 * Example #1: When I draw a "Board" on the canvas
 * Example #2: When I draw a "Rectangle" on the canvas
 * Example #3: And I draw an "Ellipse" on the canvas
 * Example #4: When we draw a "Board" on the canvas
 * Example #5: When I draw a "Rectangle" on the canvas
 */
When(/^(?:I|we) draw an? "(Board|Rectangle|Ellipse)" on the canvas$/, { timeout: 90000 }, async function (tool) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  const spot = await h.emptySpot(page, 220, 140);
  if (!spot) throw friendly({ message: 'The canvas shows no empty part to draw on.', hint: 'Draw on a page of its own (When I add a page), or in a board (When I draw a "Rectangle" in the board "…").' });
  await drawAt(this, tool, spot, 220, 140);
});

/**
 * Draw a shape inside a board, 20 px in from its top left corner: it becomes a layer of the board.
 *
 * Example #1: When I draw a "Rectangle" in the board "Board"
 * Example #2: When I draw an "Ellipse" in the board "Board"
 * Example #3: And I draw a "Rectangle" in the board "Hero"
 * Example #4: When we draw a "Board" in the board "Board"
 * Example #5: When I draw an "Ellipse" in the board "Webship test board"
 */
When(/^(?:I|we) draw an? "(Board|Rectangle|Ellipse)" in the board "([^"]*)"$/, { timeout: 90000 }, async function (tool, board) {
  await h.inWorkspace(this);
  const { from, width, height } = await insideBoard(this, board, 120, 80);
  await this.page.keyboard.press('Escape');
  await drawAt(this, tool, from, width, height);
});

/**
 * Write a text with the text tool, on an empty part of the canvas or in a board: a text layer named by its words.
 *
 * Example #1: When I write the text "Webship test text" on the canvas
 * Example #2: When I write the text "Webship test title" in the board "Board"
 * Example #3: And we write the text "Webship test text" on the canvas
 * Example #4: When I write the text "Webship test caption" in the board "Hero"
 * Example #5: When I write the text "Webship test text" in the board "Board"
 */
When(/^(?:I|we) write the text "([^"]*)" (?:on the canvas|in the board "([^"]*)")$/, { timeout: 90000 }, async function (words, board) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  let from;
  if (board) {
    ({ from } = await insideBoard(this, board, 180, 30));
    from = { x: from.x, y: from.y + 50 };
  } else {
    from = await h.emptySpot(page, 200, 40);
    if (!from) throw friendly({ message: 'The canvas shows no empty part to write on.', hint: 'Write on a page of its own (When I add a page), or in a board.' });
  }
  await page.keyboard.press('Escape');
  await writeAt(this, words, from);
});

/**
 * Draw a path with the path tool on an empty part of the canvas: three points clicked, then Enter. A layer "Path".
 *
 * Example #1: When I draw a path on the canvas
 * Example #2: When we draw a path on the canvas
 * Example #3: And I draw a path on the canvas
 * Example #4: Then I draw a path on the canvas
 * Example #5: When I draw a path on the canvas
 */
When(/^(?:I|we) draw a path on the canvas$/, { timeout: 90000 }, async function () {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  const spot = await h.emptySpot(page, 240, 120);
  if (!spot) throw friendly({ message: 'The canvas shows no empty part to draw on.', hint: 'Draw on a page of its own (When I add a page).' });
  const before = await h.layers(page);
  await page.keyboard.press('Escape');
  const tool = await h.chooseTool(this, 'Path');
  for (const [dx, dy] of [[0, 0], [120, 100], [240, 0]]) {
    await page.mouse.click(spot.x + dx, spot.y + dy);
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Enter');
  await waitDrawn(this, before, tool, 'the path was drawn');
  await page.keyboard.press('Escape');
});

/**
 * Assert that the layers of the open page list a layer, or do not (folded parents are opened first).
 *
 * Example #1: Then the layers should list "Board"
 * Example #2: Then the layers should not list "Ellipse"
 * Example #3: And the layers should list "Webship test text"
 * Example #4: Then the layers should list "Hero"
 * Example #5: Then the layers should list "Value 1"
 */
Then(/^the layers should( not)? list "([^"]*)"$/, async function (notCase, name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  const read = async () => { await h.unfoldLayers(page); return h.layers(page); };
  await h.eventually(page, read, (rows) => rows.some((l) => h.normal(l.name) === h.normal(name)) === !notCase, async (rows) => ({
    message: `The layers ${notCase ? 'list' : 'do not list'} "${name}". They are ${h.listed(rows.map((l) => l.name))}.`,
    hint: 'A layer is named after what made it until it is renamed; a deleted one leaves the list.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Assert that a layer is selected (its row is checked in the layer tree), or is not.
 *
 * Example #1: Then the layer "Board" should be selected
 * Example #2: Then the layer "Rectangle" should not be selected
 * Example #3: And the layer "Group" should be selected
 * Example #4: Then the layer "Webship test text" should be selected
 * Example #5: Then the layer "Value 2" should be selected
 */
Then(/^the layer "([^"]*)" should( not)? be selected$/, async function (name, notCase) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  const read = async () => { await h.unfoldLayers(page); return h.selectedLayers(page); };
  await h.eventually(page, read, (names) => names.some((n) => h.normal(n) === h.normal(name)) === !notCase, async (names) => ({
    message: `The layer "${name}" is ${notCase ? '' : 'not '}selected. Selected: ${h.listed(names)}.`,
    hint: 'A new shape is selected once drawn; a click on a layer\'s row selects it.',
  }), h.budget(this));
});

/**
 * Select a layer by its row in the layer tree, or add it to the selection (Shift).
 *
 * Example #1: When I select the layer "Board"
 * Example #2: When I add the layer "Ellipse" to the selection
 * Example #3: And I select the layer "Hero"
 * Example #4: When we select the layer "Rectangle"
 * Example #5: When I add the layer "Rectangle" to the selection
 */
When(/^(?:I|we) (select|add) the layer "([^"]*)"(?: to the selection)?$/, { timeout: 60000 }, async function (how, name) {
  await h.inWorkspace(this);
  await h.selectLayer(this, name, { add: how === 'add' });
});

/**
 * Rename a layer: a double click on its row, the new name typed in place of the old one, Enter.
 *
 * Example #1: When I rename the layer "Board" to "Webship test board"
 * Example #2: When we rename the layer "Rectangle" to "Webship test button"
 * Example #3: And I rename the layer "Webship test board" to "Board"
 * Example #4: When I rename the layer "Ellipse" to "Webship test dot"
 * Example #5: When I rename the layer "Group" to "Webship test group"
 */
When(/^(?:I|we) rename the layer "([^"]*)" to "([^"]*)"$/, { timeout: 60000 }, async function (from, to) {
  const page = this.page;
  await h.inWorkspace(this);
  const row = await h.findLayer(this, from);
  await row.dblclick();
  const input = page.getByTestId('layer-tree').locator('input').filter({ visible: true }).first();
  await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  await input.fill(to);
  await input.press('Enter');
  await h.eventually(page, () => h.layers(page), (rows) => rows.some((l) => h.normal(l.name) === h.normal(to)), async (rows) => ({ message: `The layer was not renamed. The layers: ${h.listed(rows.map((l) => l.name))}.`, hint: 'Enter saves the new name.' }), h.budget(this));
});

/**
 * Delete a layer: selected, then the Delete key. Its row leaves the layer tree.
 *
 * Example #1: When I delete the layer "Ellipse"
 * Example #2: When we delete the layer "Rectangle"
 * Example #3: And I delete the layer "Webship test text"
 * Example #4: When I delete the layer "Board"
 * Example #5: When I delete the layer "Path"
 */
When(/^(?:I|we) delete the layer "([^"]*)"$/, { timeout: 60000 }, async function (name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.selectLayer(this, name);
  const before = (await h.layers(page)).filter((l) => h.normal(l.name) === h.normal(name)).length;
  await page.keyboard.press('Delete');
  await h.eventually(page, () => h.layers(page), (rows) => rows.filter((l) => h.normal(l.name) === h.normal(name)).length < before, async (rows) => ({ message: `The layer "${name}" is still there. The layers: ${h.listed(rows.map((l) => l.name))}.`, hint: 'The Delete key removes the selected layers.' }), h.budget(this));
});

/**
 * Group the layers that are selected (Ctrl+G): a layer "Group" holds them and is selected.
 *
 * Example #1: When I group the selection
 * Example #2: When we group the selection
 * Example #3: And I group the selection
 * Example #4: Then I group the selection
 * Example #5: When I group the selection
 */
When(/^(?:I|we) group the selection$/, { timeout: 60000 }, async function () {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  await page.keyboard.press('ControlOrMeta+g');
  await h.eventually(page, () => h.selectedLayers(page), (names) => names.length === 1 && /^group/i.test(names[0]), async (names) => ({ message: `No group was made. Selected: ${h.listed(names)}.`, hint: 'Select the layers to group first.' }), h.budget(this));
});

/**
 * Make the selection a component (Ctrl+K); a component made a component again becomes the container of two variants
 * ("Value 1" and "Value 2").
 *
 * Example #1: When I make the selection a component
 * Example #2: When we make the selection a component
 * Example #3: And I make the selection a component
 * Example #4: Then I make the selection a component
 * Example #5: When I make the selection a component
 */
When(/^(?:I|we) make the selection a component$/, { timeout: 60000 }, async function () {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Layers');
  await h.unfoldLayers(page);
  const before = await h.layers(page);
  await page.keyboard.press('ControlOrMeta+k');
  await h.eventually(page, () => h.layers(page), (rows) => {
    const components = rows.filter((l) => l.component).length;
    const variants = rows.filter((l) => l.variant).length;
    return components > before.filter((l) => l.component).length || variants > before.filter((l) => l.variant).length;
  }, async (rows) => ({ message: `No component was made. The layers: ${h.listed(rows.map((l) => `${l.name}${l.component ? ' (component)' : ''}`))}.`, hint: 'Select a layer first; a viewer cannot make components.' }), h.budget(this));
});

/**
 * Assert that a layer is a component (a main component, its icon in the layer tree) or a variant, or is not.
 *
 * Example #1: Then the layer "Rectangle" should be a component
 * Example #2: Then the layer "Value 1" should be a variant
 * Example #3: And the layer "Value 2" should be a variant
 * Example #4: Then the layer "Ellipse" should not be a component
 * Example #5: Then the layer "Board" should be a component
 */
Then(/^the layer "([^"]*)" should( not)? be a (component|variant)$/, async function (name, notCase, kind) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.findLayer(this, name);
  await h.eventually(page, () => h.layers(page), (rows) => rows.some((l) => h.normal(l.name) === h.normal(name) && l[kind]) === !notCase, async (rows) => ({
    message: `The layer "${name}" is ${notCase ? '' : 'not '}a ${kind}. The ${kind}s: ${h.listed(rows.filter((l) => l[kind]).map((l) => l.name))}.`,
    hint: kind === 'component' ? 'Ctrl+K makes the selection a component.' : 'Ctrl+K on a component makes it the container of two variants.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Undo the last change (Ctrl+Z).
 *
 * Example #1: When I undo the last change
 * Example #2: When we undo the last change
 * Example #3: And I undo the last change
 * Example #4: Then I undo the last change
 * Example #5: When I undo the last change
 */
When(/^(?:I|we) undo the last change$/, async function () {
  await h.inWorkspace(this);
  await this.page.keyboard.press('ControlOrMeta+z');
  await h.settle(this.page, h.budget(this));
});

/**
 * Assert a value of the Design tab for the selection: "Width", "Height", "X axis", "Y axis", "Rotation", "Radius",
 * "Opacity"; "Mixed" when the selected layers differ.
 *
 * Example #1: Then the design value "Width" should be "300"
 * Example #2: Then the design value "Height" should be "Mixed"
 * Example #3: And the design value "Rotation" should be "45"
 * Example #4: Then the design value "X axis" should be "20"
 * Example #5: Then the design value "Opacity" should be "100"
 */
Then(/^the design value "([^"]*)" should be "([^"]*)"$/, async function (name, expected) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.rightTab(this, 'Design');
  await h.eventually(page, () => h.designValue(page, name), (v) => v !== null && h.normal(v) === h.normal(expected), async (v) => ({
    message: v === null ? `The Design tab has no value "${name}"; select a layer first.` : `The design value "${name}" is "${v}", not "${expected}".`,
    hint: 'The Design tab shows the values of the selected layers; "Mixed" when they differ.',
  }), h.budget(this));
});

/**
 * Set a value of the Design tab for the selection: typed in its box, then Enter.
 *
 * Example #1: When I set the design value "Width" to "300"
 * Example #2: When I set the design value "Rotation" to "45"
 * Example #3: And I set the design value "Height" to "200"
 * Example #4: When we set the design value "X axis" to "20"
 * Example #5: When I set the design value "Opacity" to "50"
 */
When(/^(?:I|we) set the design value "([^"]*)" to "([^"]*)"$/, { timeout: 60000 }, async function (name, value) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.rightTab(this, 'Design');
  const input = h.designInput(page, name);
  if (!(await input.count())) throw friendly({ message: `The Design tab has no value "${name}".`, hint: 'Select a layer first; the values are Width, Height, X axis, Y axis, Rotation, Radius, Opacity.' });
  await input.click();
  await input.fill(value);
  await input.press('Enter');
  await h.eventually(page, () => h.designValue(page, name), (v) => h.normal(v) === h.normal(value), async (v) => ({ message: `The design value "${name}" stayed "${v}".`, hint: 'Enter applies the value.' }), h.budget(this));
});

/**
 * Assert the size the canvas shows under the selection (its badge, "width x height").
 *
 * Example #1: Then the selection should measure "300 x 200"
 * Example #2: Then the selection should measure "220 x 80"
 * Example #3: And the selection should measure "300 x 60"
 * Example #4: Then the selection should measure "120 x 80"
 * Example #5: Then the selection should measure "300 x 200"
 */
Then(/^the selection should measure "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await h.inWorkspace(this);
  const read = async () => h.clean(await page.locator('g.selection-size-badge text').first().textContent({ timeout: 1000 }).catch(() => ''));
  await h.eventually(page, read, (v) => h.normal(v) === h.normal(expected), async (v) => ({
    message: v ? `The selection measures "${v}", not "${expected}".` : 'The canvas shows no size under a selection: nothing is selected.',
    hint: 'The badge under a selection shows its width and height.',
  }), h.budget(this));
});

/**
 * Add a fill, a stroke, a shadow or a blur to the selection with the "+" of its section of the Design tab.
 *
 * Example #1: When I add a "stroke" to the selection
 * Example #2: When I add a "shadow" to the selection
 * Example #3: And I add a "blur" to the selection
 * Example #4: When we add a "fill" to the selection
 * Example #5: When I add a "stroke" to the selection
 */
When(/^(?:I|we) add a "(fill|stroke|shadow|blur)" to the selection$/, { timeout: 60000 }, async function (kind) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.rightTab(this, 'Design');
  const button = page.getByTestId(`add-${kind}`);
  if (!(await button.count()) || !(await button.isEnabled().catch(() => false))) {
    throw friendly({ message: `The Design tab offers no way to add a ${kind} here.`, hint: 'Select a layer first; several layers with different values hide the "+" of a section.' });
  }
  await button.click();
  await h.settle(page, h.budget(this));
});

/**
 * Assert what a submenu of the workspace's main menu offers ("File", "Edit", "View"), or that an item is not there (a
 * viewer has no "Add as Shared Library", no "Undo").
 *
 * Example #1: Then the main menu "File" should offer "Add as Shared Library"
 * Example #2: Then the main menu "Edit" should not offer "Undo"
 * Example #3: And the main menu "File" should offer "Export boards as PDF"
 * Example #4: Then the main menu "Edit" should offer "Redo"
 * Example #5: Then the main menu "View" should offer "Hide comments"
 */
Then(/^the main menu "([^"]*)" should( not)? offer "([^"]*)"$/, { timeout: 60000 }, async function (top, notCase, item) {
  const page = this.page;
  const items = await h.mainMenuItems(this, top);
  for (let i = 0; i < 3 && (await h.openMenuItems(page)).length; i += 1) await page.keyboard.press('Escape');
  const has = items.some((i) => h.normal(i) === h.normal(item));
  if (has === !!notCase) {
    throw friendly({ message: `The main menu "${top}" ${notCase ? 'offers' : 'does not offer'} "${item}". It offers ${h.listed(items)}.`, hint: 'What the main menu offers follows the role of the account in the team.' });
  }
});

/**
 * Choose an item of a submenu of the workspace's main menu: "Export boards as PDF" of "File", "Undo" of "Edit",
 * "Hide comments" of "View".
 *
 * Example #1: When I choose "Export boards as PDF" in the main menu "File"
 * Example #2: When I choose "Hide comments" in the main menu "View"
 * Example #3: And I choose "Show comments" in the main menu "View"
 * Example #4: When we choose "Redo" in the main menu "Edit"
 * Example #5: When I choose "Add as Shared Library" in the main menu "File"
 */
When(/^(?:I|we) choose "([^"]*)" in the main menu "([^"]*)"$/, { timeout: 60000 }, async function (item, top) {
  await h.chooseInMainMenu(this, top, item);
});

/**
 * Assert that the workspace shows the toolbar "Drawing tools", or does not (a viewer of the team gets none).
 *
 * Example #1: Then the workspace should show the drawing tools
 * Example #2: Then the workspace should not show the drawing tools
 * Example #3: And the workspace should show the drawing tools
 * Example #4: But the workspace should not show the drawing tools
 * Example #5: Then the workspace should show the drawing tools
 */
Then(/^the workspace should( not)? show the drawing tools$/, async function (notCase) {
  const page = this.page;
  await h.inWorkspace(this);
  const read = async () => (await page.getByRole('toolbar', { name: 'Drawing tools' }).count()) + (await page.getByRole('button', { name: 'Toggle toolbar' }).count());
  await h.eventually(page, read, (n) => (n > 0) === !notCase, async () => ({
    message: `The workspace ${notCase ? 'shows' : 'does not show'} the drawing tools.`,
    hint: 'An editor, an admin and the owner of a team draw; a viewer only reads, comments and inspects.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Open a tab by its name: of the workspace's side bars ("Layers", "Assets", "Tokens", "Design", "Inspect"), of the
 * shortcuts ("All", "Custom", "Disabled"), of a dialog ("LIBRARIES", "This file").
 *
 * Example #1: When I open the "Inspect" tab
 * Example #2: When I open the "Assets" tab
 * Example #3: And I open the "Tokens" tab
 * Example #4: When we open the "Custom" tab
 * Example #5: When I open the "Layers" tab
 */
When(/^(?:I|we) open the "([^"]*)" tab$/, { timeout: 60000 }, async function (name) {
  const page = this.page;
  const tab = page.getByRole('tab', { name: h.exactly(name) }).filter({ visible: true }).last();
  if (!(await tab.count())) {
    const offered = await page.getByRole('tab').filter({ visible: true }).allInnerTexts().catch(() => []);
    throw friendly({ message: `The page has no tab "${name}". It has ${h.listed(offered)}.`, hint: 'Name the tab as it is written (letter case aside); a viewer has no Design tab.' });
  }
  await tab.click();
  await h.settle(page, h.budget(this));
});

/**
 * Assert that the side bars of the workspace offer a tab, or do not (a viewer has no "Design" and no "Layers" to edit).
 *
 * Example #1: Then the side panel should offer the tab "Design"
 * Example #2: Then the side panel should not offer the tab "Design"
 * Example #3: And the side panel should offer the tab "Inspect"
 * Example #4: Then the side panel should offer the tab "Tokens"
 * Example #5: But the side panel should not offer the tab "Prototype"
 */
Then(/^the side panel should( not)? offer the tab "([^"]*)"$/, async function (notCase, name) {
  const page = this.page;
  await h.inWorkspace(this);
  const read = () => page.getByTestId('right-sidebar').or(page.getByTestId('left-sidebar')).getByRole('tab', { name: h.exactly(name) }).count();
  await h.eventually(page, read, (n) => (n > 0) === !notCase, async () => ({
    message: `The side bars ${notCase ? 'offer' : 'do not offer'} the tab "${name}". They offer ${h.listed(await page.getByRole('tab').allInnerTexts())}.`,
    hint: 'A viewer of a team gets the Inspect panel alone on the right.',
  }), notCase ? 3000 : h.budget(this));
});

// ---------------------------------------------------------------------------
// Assets and shared libraries
// ---------------------------------------------------------------------------

/** The names of the components the Assets tab lists (its groups folded or not). */
async function componentNames(page) {
  return page.getByRole('tabpanel', { name: 'Assets' }).locator('[id^="component-shape-id-"] [title]').evaluateAll((es) => es.map((e) => e.getAttribute('title'))).catch(() => []);
}

/**
 * Assert that the Assets tab lists a component (of the file, or of a library it uses), or does not. Folded groups are
 * opened.
 *
 * Example #1: Then the assets should list the component "Rectangle"
 * Example #2: Then the assets should list the component "Logo"
 * Example #3: And the assets should not list the component "Logo"
 * Example #4: Then the assets should list the component "Hero"
 * Example #5: Then the assets should list the component "Board"
 */
Then(/^the assets should( not)? list the component "([^"]*)"$/, { timeout: 60000 }, async function (notCase, name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Assets');
  const panel = page.getByRole('tabpanel', { name: 'Assets' });
  const has = async () => (await componentNames(page)).some((n) => h.normal(n) === h.normal(name));
  if (!(await has())) {
    // The section of each library the file uses opens with a click on its name; a group of components with a click on
    // its title ("Components 2"), which folds it again when it was open.
    const CONTROLS = /^(manage library|filter|sort|search assets|add component|add color|add typography|local library|components\s*\d*|colors\s*\d*|typographies\s*\d*)/i;
    const buttons = panel.getByRole('button');
    for (let i = 0; i < await buttons.count(); i += 1) {
      const label = h.clean(await buttons.nth(i).innerText().catch(() => ''));
      if (label && !CONTROLS.test(label)) {
        const before = (await componentNames(page)).length;
        await buttons.nth(i).click().catch(() => {});
        await page.waitForTimeout(200);
        if ((await componentNames(page)).length < before) await buttons.nth(i).click().catch(() => {});
      }
    }
    const groups = panel.getByRole('button', { name: /^Components\s*\d+$/ });
    for (let i = 0; i < await groups.count() && !(await has()); i += 1) {
      const before = (await componentNames(page)).length;
      await groups.nth(i).click();
      await page.waitForTimeout(300);
      if (!(await has()) && (await componentNames(page)).length < before) {
        await groups.nth(i).click();
        await page.waitForTimeout(200);
      }
    }
  }
  const found = await has();
  if (found === !!notCase) {
    throw friendly({ message: `The assets ${notCase ? 'list' : 'do not list'} the component "${name}". They list ${h.listed(await componentNames(page))}.`, hint: 'A component of the file comes with Ctrl+K; one of a shared library comes once the library is connected.' });
  }
});

/**
 * Assert what the Assets tab shows ("Local library", "Components", "Colors", "Typographies", the name of a connected
 * library), or does not.
 *
 * Example #1: Then the assets should show "Local library"
 * Example #2: Then the assets should show "Typographies"
 * Example #3: And the assets should show "Style guide"
 * Example #4: Then the assets should not show "Style guide"
 * Example #5: Then the assets should show "Colors"
 */
Then(/^the assets should( not)? show "([^"]*)"$/, async function (notCase, text) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Assets');
  const read = async () => h.clean(await page.getByRole('tabpanel', { name: 'Assets' }).innerText().catch(() => ''));
  await h.eventually(page, read, (t) => h.mentions(t, text) === !notCase, async (t) => ({
    message: `The assets ${notCase ? 'show' : 'do not show'} "${text}". They show "${t.slice(0, 300)}".`,
    hint: 'The Assets tab shows the local library of the file, then each library it uses.',
  }), notCase ? 3000 : h.budget(this));
});

/** Open the libraries dialog of the file (the button "Manage library" of the Assets tab). */
async function librariesDialog(world) {
  const page = world.page;
  await h.inWorkspace(world);
  await h.leftTab(world, 'Assets');
  await page.getByTestId('libraries').click();
  const modal = page.getByTestId('libraries-modal');
  await modal.waitFor({ state: 'visible', timeout: h.budget(world) });
  return modal;
}

/**
 * Connect a shared library of the team to the open file: the libraries dialog, its tab "LIBRARIES", "Connect library"
 * on the library, then the dialog closed.
 *
 * Example #1: When I connect the library "Style guide"
 * Example #2: When we connect the library "Style guide"
 * Example #3: And I connect the library "Style guide"
 * Example #4: When I connect the library "Webship test library"
 * Example #5: When I connect the library "Style guide"
 */
When(/^(?:I|we) connect the library "([^"]*)"$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  const modal = await librariesDialog(this);
  await modal.getByRole('tab', { name: /^libraries$/i }).click();
  const item = modal.getByTestId('library-item').filter({ hasText: name }).first();
  await item.waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  if (!(await item.count())) {
    throw friendly({ message: `The shared libraries do not list "${name}". They list ${h.listed(await modal.getByTestId('library-item').allInnerTexts())}.`, hint: 'A file becomes a shared library with "Add as Shared Library"; a library already connected is not listed there.' });
  }
  await item.getByRole('button', { name: 'Connect library' }).click();
  await modal.getByRole('tab', { name: 'This file' }).click();
  await h.eventually(page, async () => h.clean(await modal.innerText()), (t) => h.mentions(t, name), async (t) => ({ message: `The library "${name}" was not connected: "${t.slice(0, 200)}".`, hint: 'The tab "This file" lists the connected libraries.' }), h.budget(this));
  await modal.getByRole('button', { name: 'Close' }).first().click();
  await h.settle(page, h.budget(this));
});

/**
 * Disconnect a library from the open file: the libraries dialog, "Disconnect library" on it, then the dialog closed.
 *
 * Example #1: When I disconnect the library "Style guide"
 * Example #2: When we disconnect the library "Style guide"
 * Example #3: And I disconnect the library "Style guide"
 * Example #4: When I disconnect the library "Webship test library"
 * Example #5: When I disconnect the library "Style guide"
 */
When(/^(?:I|we) disconnect the library "([^"]*)"$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  const modal = await librariesDialog(this);
  await modal.getByRole('tab', { name: 'This file' }).click();
  const button = modal.getByRole('button', { name: 'Disconnect library' });
  const text = h.clean(await modal.innerText());
  if (!h.mentions(text, name) || !(await button.count())) {
    throw friendly({ message: `The file is not connected to the library "${name}": "${text.slice(0, 200)}".`, hint: 'Connect it first (When I connect the library "…").' });
  }
  await button.first().click();
  await h.settle(page, h.budget(this));
  await modal.getByRole('button', { name: 'Close' }).first().click();
  await h.settle(page, h.budget(this));
});

// ---------------------------------------------------------------------------
// Other people in the file
// ---------------------------------------------------------------------------

/**
 * Have another account of the registry open a file in a browser of its own, as a second person working in it.
 *
 * Example #1: Given "editor" has the file "Homepage" open
 * Example #2: Given "admin" has the file "Homepage" open
 * Example #3: And "editor" has the file "Webship test file" open
 * Example #4: Given "viewer" has the file "Homepage" open
 * Example #5: Given "editor" has the file "Pricing page" open
 */
Given(/^"([^"]*)" has the file "([^"]*)" open$/, { timeout: 120000 }, async function (handle, name) {
  const api = await h.apiAs(this, handle);
  this.__extraContexts = this.__extraContexts || [];
  this.__extraContexts.push(api.context);
  for (const team of await h.teamsOf(api.call)) {
    const file = (await h.teamFiles(api.call, team.id)).find((f) => h.normal(f.name) === h.normal(name));
    if (file) {
      const other = await api.context.newPage();
      await h.openIn(other, h.screenUrl(this, 'workspace', { 'team-id': team.id, 'file-id': file.id }), h.budget(this) * 3);
      await other.getByTestId('viewport').waitFor({ state: 'visible', timeout: h.budget(this) * 3 });
      this.__others = { ...(this.__others || {}), [handle]: other };
      return;
    }
  }
  throw friendly({ message: `"${handle}" sees no file "${name}".`, hint: 'The account must be a member of the file\'s team.' });
});

/**
 * Close the file another account opened (its page closes): it leaves the people of the file.
 *
 * Example #1: When "editor" closes the file
 * Example #2: When "admin" closes the file
 * Example #3: And "editor" closes the file
 * Example #4: When "viewer" closes the file
 * Example #5: Then "editor" closes the file
 */
When(/^"([^"]*)" closes the file$/, async function (handle) {
  const other = (this.__others || {})[handle];
  if (!other) throw friendly({ message: `"${handle}" has no file open.`, hint: 'Open one first: Given "editor" has the file "Homepage" open.' });
  await other.close();
  delete this.__others[handle];
});

/**
 * Assert that the people working in the open file (their pictures at the top right) include an account, by its
 * handle or its name, or do not.
 *
 * Example #1: Then the file should show "editor" among its users
 * Example #2: Then the file should not show "editor" among its users
 * Example #3: And the file should show "Owner Test" among its users
 * Example #4: Then the file should show "admin" among its users
 * Example #5: Then the file should not show "Editor Test" among its users
 */
Then(/^the file should( not)? show "([^"]*)" among its users$/, { timeout: 60000 }, async function (notCase, who) {
  const page = this.page;
  await h.inWorkspace(this);
  const name = h.nameOf(this, who);
  const read = async () => (await page.getByTestId('active-users-list').getByRole('img').evaluateAll((es) => es.map((e) => e.getAttribute('alt') || e.getAttribute('aria-label') || '')).catch(() => [])).map(h.clean);
  await h.eventually(page, read, (names) => names.some((n) => h.normal(n) === h.normal(name)) === !notCase, async (names) => ({
    message: `The file ${notCase ? 'shows' : 'does not show'} "${name}" among its users. It shows ${h.listed(names)}.`,
    hint: 'The people in a file come and go within seconds, over the site\'s live connection.',
  }), h.budget(this) * 3);
});
