'use strict';

// Comments on a file (written, listed, their bubbles on the canvas), the
// Inspect panel a developer reads (its panels, its code), and design tokens
// (made, refused, applied to a layer).

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/** Whether the workspace shows its comments panel (the comments mode). */
async function commentsOpen(page) {
  return (await page.locator('[class*="workspace_comments__comments-section"]').filter({ visible: true }).count()) > 0;
}

/** Turn the comments mode of the workspace on ("Comments (C)"). */
async function openComments(world) {
  const page = world.page;
  if (await commentsOpen(page)) return;
  await page.getByRole('button', { name: 'Comments (C)' }).click();
  await page.locator('[class*="workspace_comments__comments-section"]').first().waitFor({ state: 'visible', timeout: h.budget(world) });
}

/** The texts of the comment threads the comments panel lists. */
async function threadTexts(page) {
  return (await page.locator('[class*="workspace_comments__thread-groups"] [class*="comments__comment-text"]').allInnerTexts().catch(() => [])).map(h.clean);
}

/**
 * Write a comment on a board of the open file: the comments mode, a click in the board (30 px in from its top left
 * corner), the words typed, "Post". The thread is listed in the comments panel.
 *
 * Example #1: When I add the comment "Webship test comment" on the board "Footer"
 * Example #2: When we add the comment "Webship test: make it blue" on the board "Hero"
 * Example #3: And I add the comment "Webship test comment" on the board "Board"
 * Example #4: When I add the comment "Webship test note" on the board "Footer"
 * Example #5: When I add the comment "Webship test comment" on the board "Hero"
 */
When(/^(?:I|we) add the comment "([^"]*)" on the board "([^"]*)"$/, { timeout: 90000 }, async function (words, board) {
  const page = this.page;
  await h.inWorkspace(this);
  const box = await h.shapeBox(this, board);
  await openComments(this);
  await page.mouse.click(box.x + 30, box.y + 20);
  const input = page.locator('[class*="comments__comment-input"]').filter({ visible: true }).first();
  try {
    await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  } catch (err) {
    throw friendly({ message: `No comment box opened on the board "${board}".`, cause: err, hint: 'In the comments mode a click on the canvas opens a new thread; the board must be on the screen.' });
  }
  await input.click();
  await page.keyboard.type(words);
  await page.getByRole('button', { name: 'Post' }).filter({ visible: true }).first().click();
  await h.eventually(page, () => threadTexts(page), (texts) => texts.some((t) => h.normal(t) === h.normal(words)), async (texts) => ({ message: `The comment "${words}" was not posted. The comments: ${h.listed(texts)}.`, hint: '"Post" sends the comment.' }), h.budget(this));
  await page.keyboard.press('Escape');
});

/**
 * Assert that the comments panel of the open file lists a thread with a text, or does not (the comments mode is
 * turned on first).
 *
 * Example #1: Then the comments should list "Can the hero be taller?"
 * Example #2: Then the comments should not list "Webship test comment"
 * Example #3: And the comments should list "Webship test comment"
 * Example #4: Then the comments should list "Webship test note"
 * Example #5: But the comments should not list "Webship test note"
 */
Then(/^the comments should( not)? list "([^"]*)"$/, { timeout: 60000 }, async function (notCase, words) {
  const page = this.page;
  await h.inWorkspace(this);
  await openComments(this);
  await h.eventually(page, () => threadTexts(page), (texts) => texts.some((t) => h.normal(t) === h.normal(words)) === !notCase, async (texts) => ({
    message: `The comments ${notCase ? 'list' : 'do not list'} "${words}". They list ${h.listed(texts)}.`,
    hint: 'The comments panel lists the threads of the file; a viewer of the team reads them too.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Turn the comments mode of the workspace off (the "Close" of the comments panel): the bubbles then follow the
 * setting of the View menu ("Hide comments", "Show comments"), which the comments mode overrides while it is on.
 *
 * Example #1: When I close the comments panel
 * Example #2: And I close the comments panel
 * Example #3: When we close the comments panel
 * Example #4: Then I close the comments panel
 * Example #5: When I close the comments panel
 */
When(/^(?:I|we) close the comments panel$/, { timeout: 60000 }, async function () {
  const page = this.page;
  await h.inWorkspace(this);
  if (!(await commentsOpen(page))) return;
  const section = page.locator('[class*="workspace_comments__comments-section"]').filter({ visible: true }).first();
  const close = section.getByRole('button', { name: 'Close' }).first();
  if (await close.count()) await close.click(); else await page.getByRole('button', { name: 'Comments (C)' }).click();
  await h.eventually(page, () => commentsOpen(page), (open) => !open, async () => ({ message: 'The comments panel is still open.', hint: 'Its "Close" turns the comments mode off.' }), h.budget(this));
});

/**
 * Assert how many comment bubbles the canvas shows (in the workspace or in the view mode's comments): none once the
 * comments are hidden from the View menu.
 *
 * Example #1: Then the page should show 1 comment bubble
 * Example #2: Then the page should show 2 comment bubbles
 * Example #3: And the page should show 0 comment bubbles
 * Example #4: Then the page should show 2 comment bubbles
 * Example #5: Then the page should show 1 comment bubble
 */
Then(/^the page should show (\d+) comment bubbles?$/, async function (count) {
  const page = this.page;
  const read = () => page.locator('[data-testid^="floating-thread-bubble"]').filter({ visible: true }).count();
  await h.eventually(page, read, (n) => n === Number(count), async (n) => ({
    message: `The page shows ${n} comment bubble(s), not ${count}.`,
    hint: 'Each thread of the page has its bubble on the canvas; "Hide comments" of the View menu hides them.',
  }), h.budget(this));
});

/**
 * Assert a row of a panel of the Inspect tab (or of the view mode's inspect) for the selection: the panel by its title
 * ("Size and position", "Fill", "Stroke", "Shadow", "Blur"), the row by its name ("Width", "Background", "Border
 * width"), its value (or a part of it).
 *
 * Example #1: Then the inspect panel "Size and position" should show "Width" as "300px"
 * Example #2: Then the inspect panel "Fill" should show "Background" as "#B1B2B5 100%"
 * Example #3: And the inspect panel "Stroke" should show "Border width" as "1px"
 * Example #4: Then the inspect panel "Shadow" should show "Drop shadow" as "4px 4px 4px 0px"
 * Example #5: Then the inspect panel "Blur" should show "Filter" as "blur(4px)"
 */
Then(/^the inspect panel "([^"]*)" should show "([^"]*)" as "([^"]*)"$/, { timeout: 60000 }, async function (title, term, value) {
  const page = this.page;
  if (h.screenOf(page) === 'workspace' && (await page.getByTestId('right-sidebar').getByRole('tab', { name: 'Inspect' }).count())) await h.rightTab(this, 'Inspect');
  await h.eventually(page, () => h.inspectPanels(page), (panels) => {
    const panel = panels.find((p) => h.normal(p.title) === h.normal(title));
    const row = panel && panel.rows.find(([t]) => h.normal(t) === h.normal(term));
    return !!row && h.mentions(row[1], value);
  }, async (panels) => {
    const panel = panels.find((p) => h.normal(p.title) === h.normal(title));
    return {
      message: panel
        ? `The inspect panel "${title}" does not show "${term}" as "${value}". It shows ${h.listed(panel.rows.map(([t, d]) => `${t}: ${d}`))}.`
        : `The inspect has no panel "${title}". It has ${h.listed(panels.map((p) => p.title))}.`,
      hint: 'Select a layer first; the Inspect tab shows a panel for each kind of value the layer has.',
    };
  }, h.budget(this));
});

/**
 * Switch what the Inspect tab shows: "Styles", "Computed" or "Code".
 *
 * Example #1: When I switch the inspect panel to "Code"
 * Example #2: When I switch the inspect panel to "Styles"
 * Example #3: And I switch the inspect panel to "Computed"
 * Example #4: When we switch the inspect panel to "Code"
 * Example #5: When I switch the inspect panel to "Styles"
 */
When(/^(?:I|we) switch the inspect panel to "([^"]*)"$/, { timeout: 60000 }, async function (view) {
  const page = this.page;
  if (h.screenOf(page) === 'workspace' && (await page.getByTestId('right-sidebar').getByRole('tab', { name: 'Inspect' }).count())) await h.rightTab(this, 'Inspect');
  const box = page.getByRole('combobox', { name: 'Switch inspect tab' }).first();
  if (!(await box.count())) throw friendly({ message: 'The inspect panel has no switch of what it shows.', hint: 'Select a layer and open the Inspect tab first.' });
  await box.click();
  const option = page.getByRole('option', { name: h.exactly(view) });
  if (!(await option.count())) throw friendly({ message: `The inspect panel offers no "${view}". It offers ${h.listed(await page.getByRole('option').allInnerTexts())}.`, hint: 'It offers Styles, Computed and Code.' });
  await option.click();
  await h.settle(page, h.budget(this));
});

/**
 * Assert that the code the Inspect tab shows (its CSS and its HTML) contains a text.
 *
 * Example #1: Then the inspect code should contain "width: 120px;"
 * Example #2: Then the inspect code should contain "background: #B1B2B5FF;"
 * Example #3: And the inspect code should contain "<div class=\"shape rect"
 * Example #4: Then the inspect code should contain "height: 80px;"
 * Example #5: Then the inspect code should contain "position: absolute;"
 */
Then(/^the inspect code should contain "((?:[^"\\]|\\.)*)"$/, async function (expected) {
  const page = this.page;
  const wanted = expected.replace(/\\"/g, '"');
  const read = async () => {
    const side = page.getByTestId('right-sidebar');
    return h.clean(await ((await side.count()) ? side : page.locator('body')).innerText().catch(() => ''));
  };
  await h.eventually(page, read, (text) => text.includes(h.clean(wanted)), async (text) => ({
    message: `The inspect code does not contain "${wanted}". It shows "${text.slice(0, 400)}".`,
    hint: 'Switch the inspect panel to "Code" first; it shows the CSS and the HTML of the selection.',
  }), h.budget(this));
});

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

/** The token form of the workspace for a type: the Tokens tab, "Add token: <type>", its name and value typed in. */
async function fillTokenForm(world, type, name, value) {
  const page = world.page;
  await h.inWorkspace(world);
  await h.leftTab(world, 'Tokens');
  const add = page.getByRole('button', { name: `Add token: ${type}`, exact: true });
  if (!(await add.count())) {
    const offered = await page.getByRole('button', { name: /^Add token: / }).evaluateAll((es) => es.map((e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/^Add token: /, '')));
    throw friendly({ message: `The Tokens tab has no type "${type}". It has ${h.listed(offered)}.`, hint: 'Name the type as the Tokens tab writes it ("Color", "Border Radius", "Dimensions", …); a viewer cannot make tokens.' });
  }
  await add.click();
  const form = page.getByTestId('token-update-create-modal');
  await form.waitFor({ state: 'visible', timeout: h.budget(world) });
  await form.getByRole('textbox', { name: 'Name' }).fill(name);
  await form.getByRole('textbox', { name: 'Value' }).fill(value);
  await page.waitForTimeout(400);
  return form;
}

/** A token's pill in the Tokens tab by its name (the pill is named by its value and its name). */
function tokenPill(page, name) {
  return page.getByTestId('tokens-sidebar').getByRole('button', { name: new RegExp(`(^|\\s)${h.escapeRegExp(name)}$`, 'i') }).first();
}

/**
 * Make a design token of a type in the open file: the Tokens tab, "Add token: <type>", its name and value, "Save". The
 * first token of a file makes its set "Global", active.
 *
 * Example #1: When I create a "Color" token "webship.test.red" with the value "#ff0000"
 * Example #2: When we create a "Border Radius" token "webship.test.round" with the value "8"
 * Example #3: And I create a "Color" token "webship.test.blue" with the value "#0000ff"
 * Example #4: When I create a "Dimensions" token "webship.test.size" with the value "120"
 * Example #5: When I create a "Color" token "webship.test.alias" with the value "{webship.test.red}"
 */
When(/^(?:I|we) create a "([^"]*)" token "([^"]*)" with the value "([^"]*)"$/, { timeout: 90000 }, async function (type, name, value) {
  const page = this.page;
  const form = await fillTokenForm(this, type, name, value);
  const save = form.getByRole('button', { name: 'Save' });
  if (!(await save.isEnabled())) {
    throw friendly({ message: `The token "${name}" cannot be saved: ${h.clean(await form.innerText()).slice(0, 300)}.`, hint: 'The form says what it refuses under its fields.' });
  }
  await save.click();
  await form.waitFor({ state: 'hidden', timeout: h.budget(this) }).catch(() => {});
  await h.eventually(page, () => tokenPill(page, name).count(), (n) => n > 0, async () => ({ message: `The token "${name}" is not listed after it was saved.`, hint: 'A token is listed under its type, its name split in groups at the dots.' }), h.budget(this));
});

/**
 * Fill in the token form of a type without saving it: to see what the form refuses ("Invalid color value: 1").
 *
 * Example #1: When I try to create a "Color" token "webship.test.red" with the value "1"
 * Example #2: When we try to create a "Color" token "webship.test.self" with the value "{webship.test.self}"
 * Example #3: And I try to create a "Color" token "webship.test.missing" with the value "{webship.test.nothing}"
 * Example #4: When I try to create a "Color" token "" with the value "#ff0000"
 * Example #5: When I try to create a "Color" token "webship.test.red" with the value "1"
 */
When(/^(?:I|we) try to create a "([^"]*)" token "([^"]*)" with the value "([^"]*)"$/, { timeout: 90000 }, async function (type, name, value) {
  await fillTokenForm(this, type, name, value);
});

/**
 * Assert that the Tokens tab lists a token by its name, or does not.
 *
 * Example #1: Then the tokens should list "webship.test.red"
 * Example #2: Then the tokens should not list "webship.test.red"
 * Example #3: And the tokens should list "webship.test.blue"
 * Example #4: Then the tokens should list "webship.test.round"
 * Example #5: But the tokens should not list "webship.test.blue"
 */
Then(/^the tokens should( not)? list "([^"]*)"$/, async function (notCase, name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Tokens');
  await h.eventually(page, () => tokenPill(page, name).count(), (n) => (n > 0) === !notCase, async () => ({
    message: `The tokens ${notCase ? 'list' : 'do not list'} "${name}". The Tokens tab shows "${h.clean(await page.getByTestId('tokens-sidebar').innerText().catch(() => '')).slice(0, 300)}".`,
    hint: 'A token is listed under its type once saved.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Apply a token to the selected layer through its menu (a right click on its pill): "Fill", "Stroke", or another
 * property the menu offers for its type.
 *
 * Example #1: When I apply the token "webship.test.red" to the selection as "Fill"
 * Example #2: When I apply the token "webship.test.red" to the selection as "Stroke"
 * Example #3: And I apply the token "webship.test.blue" to the selection as "Fill"
 * Example #4: When we apply the token "webship.test.round" to the selection as "All"
 * Example #5: When I apply the token "webship.test.red" to the selection as "Fill"
 */
When(/^(?:I|we) apply the token "([^"]*)" to the selection as "([^"]*)"$/, { timeout: 90000 }, async function (name, property) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Tokens');
  const pill = tokenPill(page, name);
  if (!(await pill.count())) throw friendly({ message: `The tokens do not list "${name}".`, hint: 'Make it first: When I create a "Color" token "…" with the value "…".' });
  await pill.click({ button: 'right' });
  const menu = page.getByTestId('tokens-context-menu-for-token');
  await menu.waitFor({ state: 'visible', timeout: h.budget(this) });
  const item = menu.getByText(property, { exact: true }).first();
  if (!(await item.count())) {
    throw friendly({ message: `The menu of the token "${name}" offers no "${property}". It offers ${h.listed((await menu.innerText()).split('\n'))}.`, hint: 'A color token applies as Fill or Stroke; select a layer first.' });
  }
  await item.click();
  await h.settle(page, h.budget(this));
});

/**
 * Assert that a token is applied to a property of the selection: its name in the section of the Design tab ("Fill",
 * "Stroke").
 *
 * Example #1: Then the token "webship.test.red" should be applied to the "Fill"
 * Example #2: Then the token "webship.test.red" should be applied to the "Stroke"
 * Example #3: And the token "webship.test.blue" should be applied to the "Fill"
 * Example #4: Then the token "webship.test.red" should be applied to the "Fill"
 * Example #5: Then the token "webship.test.blue" should be applied to the "Stroke"
 */
Then(/^the token "([^"]*)" should be applied to the "([^"]*)"$/, async function (name, property) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.rightTab(this, 'Design');
  const section = page.getByTestId('right-sidebar').getByRole('region', { name: `${property} section` });
  const read = async () => h.clean(await section.innerText().catch(() => ''));
  await h.eventually(page, read, (text) => h.mentions(text, name), async (text) => ({
    message: text ? `The section "${property}" of the Design tab does not show the token "${name}": "${text.slice(0, 200)}".` : `The Design tab has no section "${property}".`,
    hint: 'Apply the token first (When I apply the token "…" to the selection as "…"); select the layer it was applied to.',
  }), h.budget(this));
});

/**
 * Assert that a set of tokens is active in the open file (its box ticked in the sets of the Tokens tab).
 *
 * Example #1: Then the token set "Global" should be active
 * Example #2: And the token set "Global" should be active
 * Example #3: Then the token set "Global" should be active
 * Example #4: Then the token set "Webship test set" should be active
 * Example #5: But the token set "Global" should be active
 */
Then(/^the token set "([^"]*)" should be active$/, async function (name) {
  const page = this.page;
  await h.inWorkspace(this);
  await h.leftTab(this, 'Tokens');
  const set = page.getByTestId('token-management-sidebar').getByRole('button', { name: h.exactly(name) }).first();
  const read = async () => ((await set.count()) ? ((await set.getByRole('checkbox').isChecked().catch(() => false)) ? 'active' : 'inactive') : 'missing');
  await h.eventually(page, read, (v) => v === 'active', async (v) => ({
    message: v === 'missing' ? `The Tokens tab has no set "${name}".` : `The token set "${name}" is not active.`,
    hint: 'The first token of a file makes the set "Global" and turns it on.',
  }), h.budget(this));
});
