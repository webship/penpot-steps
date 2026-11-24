'use strict';

// The view mode of a file (its boards one after another, its zoom, its
// comments and inspect sections) and the link it shares with people who have
// no account.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/** Make sure the scenario's page is the view mode. */
async function inViewer(world) {
  const page = world.page;
  if (h.screenOf(page) !== 'viewer') {
    throw friendly({ message: `The view mode is not open: ${await h.pageSummary(page)}.`, hint: 'Open it from a file first: When I open the view mode.' });
  }
}

/** The lines of the view mode's header (the project, the file and page, the board, the zoom). */
async function bannerLines(page) {
  return (await page.getByRole('banner').innerText().catch(() => '')).split('\n').map(h.clean).filter(Boolean);
}

/** The share dialog of the view mode ("Share"), opened when it is not. */
async function shareDialog(world) {
  const page = world.page;
  await inViewer(world);
  if (!/share/i.test(await h.dialogText(page))) {
    await page.getByRole('banner').getByRole('button', { name: 'Share' }).click();
    await h.eventually(page, () => h.dialogText(page), (t) => /share/i.test(t), async () => ({ message: 'The share dialog did not open.', hint: 'The button "Share" of the view mode opens it.' }), h.budget(world));
  }
  return h.dialog(page);
}

/**
 * Open the view mode of the open file (the button "View mode" at the top right of the workspace): it opens in a new
 * tab, which the steps after work in.
 *
 * Example #1: When I open the view mode
 * Example #2: When we open the view mode
 * Example #3: And I open the view mode
 * Example #4: Then I open the view mode
 * Example #5: When I open the view mode
 */
When(/^(?:I|we) open the view mode$/, { timeout: 90000 }, async function () {
  const page = this.page;
  await h.inWorkspace(this);
  const link = page.locator('a[title^="View mode"]').first();
  const [viewer] = await Promise.all([page.context().waitForEvent('page', { timeout: h.budget(this) * 2 }), link.click()]);
  await viewer.waitForLoadState('domcontentloaded').catch(() => {});
  await h.recordToasts(viewer);
  this.__workspacePage = page;
  this.page = viewer;
  await viewer.getByRole('banner').waitFor({ state: 'visible', timeout: h.budget(this) * 2 });
  await h.settle(viewer, h.budget(this));
});

/**
 * Assert the board the view mode shows (its name in the header).
 *
 * Example #1: Then the view mode should show the board "Footer"
 * Example #2: Then the view mode should show the board "Hero"
 * Example #3: And the view mode should show the board "Footer"
 * Example #4: Then the view mode should show the board "Board"
 * Example #5: Then the view mode should show the board "Hero"
 */
Then(/^the view mode should show the board "([^"]*)"$/, async function (board) {
  const page = this.page;
  await inViewer(this);
  await h.eventually(page, () => bannerLines(page), (lines) => lines.some((l) => h.normal(l) === h.normal(board)), async (lines) => ({
    message: `The view mode does not show the board "${board}". Its header says ${h.listed(lines)}.`,
    hint: 'The view mode shows the boards of the page one after another, in the order of the layers.',
  }), h.budget(this));
});

/**
 * Assert the position of the board the view mode shows among the boards of the page ("2 / 2").
 *
 * Example #1: Then the view mode should show the board 1 of 2
 * Example #2: Then the view mode should show the board 2 of 2
 * Example #3: And the view mode should show the board 1 of 1
 * Example #4: Then the view mode should show the board 2 of 3
 * Example #5: Then the view mode should show the board 1 of 2
 */
Then(/^the view mode should show the board (\d+) of (\d+)$/, async function (index, total) {
  const page = this.page;
  await inViewer(this);
  const want = `${index} / ${total}`;
  const read = async () => h.clean(await page.getByText(/^\s*\d+\s*\/\s*\d+\s*$/).first().innerText().catch(() => ''));
  await h.eventually(page, read, (t) => t === want, async (t) => ({ message: `The view mode shows the board "${t || '?'}", not "${want}".`, hint: 'The counter beside the arrows shows the board on show and how many there are.' }), h.budget(this));
});

/**
 * Show the next board, or the one before, with the arrows of the view mode ("Next", "Previous").
 *
 * Example #1: When I go to the next board
 * Example #2: When I go to the previous board
 * Example #3: And we go to the next board
 * Example #4: When I go to the next board
 * Example #5: When I go to the previous board
 */
When(/^(?:I|we) go to the (next|previous) board$/, { timeout: 60000 }, async function (which) {
  const page = this.page;
  await inViewer(this);
  const before = new URL(page.url()).searchParams.get('index');
  const button = page.getByRole('button', { name: which === 'next' ? 'Next' : 'Previous', exact: true });
  if (!(await button.count())) throw friendly({ message: `The view mode has no "${which === 'next' ? 'Next' : 'Previous'}" arrow here.`, hint: 'The first board has no "Previous", the last no "Next".' });
  await button.click();
  await page.waitForURL((url) => url.searchParams.get('index') !== before, { timeout: h.budget(this) }).catch(() => {});
  await h.settle(page, h.budget(this));
});

/**
 * Set the zoom of the view mode from its list (the zoom in the header): "Fit" (scale down to fit), "Fill" (scale to
 * fill), and the like. The address keeps it.
 *
 * Example #1: When I set the zoom of the view mode to "Fit"
 * Example #2: When I set the zoom of the view mode to "Fill"
 * Example #3: And we set the zoom of the view mode to "Fit"
 * Example #4: When I set the zoom of the view mode to "Fill"
 * Example #5: When I set the zoom of the view mode to "Fit"
 */
When(/^(?:I|we) set the zoom of the view mode to "([^"]*)"$/, { timeout: 60000 }, async function (zoom) {
  const page = this.page;
  await inViewer(this);
  await page.getByTitle('Zoom').first().click();
  const item = page.getByRole('listitem').filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(zoom)}\\b`, 'i') }).filter({ visible: true }).first();
  if (!(await item.count())) {
    throw friendly({ message: `The zoom of the view mode offers no "${zoom}".`, hint: 'It offers "Fit - Scale down to fit" and "Fill - Scale to fill", among others.' });
  }
  await item.click();
  await page.waitForURL((url) => url.searchParams.get('zoom') === h.normal(zoom), { timeout: h.budget(this) }).catch(() => {});
});

/**
 * Open a section of the view mode with its button in the header: "Interactions", "Comments" or "Inspect".
 *
 * Example #1: When I open the "Comments" section of the view mode
 * Example #2: When I open the "Inspect" section of the view mode
 * Example #3: And I open the "Interactions" section of the view mode
 * Example #4: When we open the "Inspect" section of the view mode
 * Example #5: When I open the "Comments" section of the view mode
 */
When(/^(?:I|we) open the "([^"]*)" section of the view mode$/, { timeout: 60000 }, async function (section) {
  const page = this.page;
  await inViewer(this);
  const button = page.getByRole('banner').getByRole('button', { name: new RegExp(`^${h.escapeRegExp(section)} \\(`, 'i') }).first();
  if (!(await button.count())) throw friendly({ message: `The view mode has no section "${section}".`, hint: 'Its sections are Interactions, Comments and Inspect.' });
  await button.click();
  await page.waitForURL((url) => url.searchParams.get('section') === h.normal(section), { timeout: h.budget(this) }).catch(() => {});
  await h.settle(page, h.budget(this));
});

/**
 * Add an export to the board the view mode's inspect shows ("Add export"): its button "Export 1 element" comes.
 *
 * Example #1: When I add an export in the view mode
 * Example #2: When we add an export in the view mode
 * Example #3: And I add an export in the view mode
 * Example #4: Then I add an export in the view mode
 * Example #5: When I add an export in the view mode
 */
When(/^(?:I|we) add an export in the view mode$/, { timeout: 60000 }, async function () {
  const page = this.page;
  await inViewer(this);
  const add = page.getByRole('button', { name: 'Add export' }).first();
  if (!(await add.count())) throw friendly({ message: 'The view mode offers no "Add export".', hint: 'Open its "Inspect" section first.' });
  await add.click();
  await page.getByRole('button', { name: /^Export \d+ elements?$/ }).first().waitFor({ state: 'visible', timeout: h.budget(this) });
});

/**
 * Make a link that shares the view mode of the file with anyone: "Share", then "Get link". The link is kept for the
 * steps after.
 *
 * Example #1: When I create a share link
 * Example #2: When we create a share link
 * Example #3: And I create a share link
 * Example #4: Then I create a share link
 * Example #5: When I create a share link
 */
When(/^(?:I|we) create a share link$/, { timeout: 60000 }, async function () {
  const page = this.page;
  const dlg = await shareDialog(this);
  const get = await h.dialogControl(page, 'Get link');
  if (get) await get.click();
  const field = dlg.locator('input[type="text"]').first();
  const link = await h.eventually(page, () => field.inputValue().catch(() => ''), (v) => /share-id=/.test(v), async () => ({ message: 'The share dialog gave no link.', hint: '"Get link" makes the link; an existing link shows at once.' }), h.budget(this));
  this.__shareLink = link;
});

/**
 * Destroy the share link of the file: "Destroy link" in the share dialog, then "Destroy link" again where it asks.
 *
 * Example #1: When I destroy the share link
 * Example #2: When we destroy the share link
 * Example #3: And I destroy the share link
 * Example #4: Then I destroy the share link
 * Example #5: When I destroy the share link
 */
When(/^(?:I|we) destroy the share link$/, { timeout: 60000 }, async function () {
  const page = this.page;
  await shareDialog(this);
  const destroy = await h.dialogControl(page, 'Destroy link');
  if (!destroy) throw friendly({ message: 'The file has no share link to destroy.', hint: 'Create one first: When I create a share link.' });
  await destroy.click();
  await h.eventually(page, () => h.dialogText(page), (t) => /are you sure/i.test(t), async (t) => ({ message: `The site did not ask before destroying the link: "${t}".`, hint: 'The destruction of a link asks first.' }), h.budget(this));
  await h.pressInDialog(this, 'Destroy link');
  await h.eventually(page, async () => !!(await h.dialogControl(page, 'Get link')), (ok) => ok, async () => ({ message: 'The share link is still there.', hint: 'Once destroyed, the dialog offers "Get link" again.' }), h.budget(this));
});

/**
 * Assert what a person with no account sees with the share link (in a browser of their own): the view mode of the
 * file, or, once the link is destroyed, the login form and no file.
 *
 * Example #1: Then a visitor should see the file "Homepage" with the share link
 * Example #2: Then a visitor should not see the file "Homepage" with the share link
 * Example #3: And a visitor should see the file "Homepage" with the share link
 * Example #4: Then a visitor should see the file "Webship test file" with the share link
 * Example #5: But a visitor should not see the file "Webship test file" with the share link
 */
Then(/^a visitor should( not)? see the file "([^"]*)" with the share link$/, { timeout: 120000 }, async function (notCase, file) {
  const link = this.__shareLink;
  if (!link) throw friendly({ message: 'The scenario made no share link.', hint: 'Create one first: When I create a share link.' });
  const browser = this.playwrightBrowser || this.page.context().browser();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const visitor = await context.newPage();
    await h.openIn(visitor, link, h.budget(this) * 3);
    await h.eventually(visitor, async () => ({ title: await visitor.title(), login: await visitor.getByRole('textbox', { name: 'Work email' }).count() }), (v) => {
      const sees = /view mode/i.test(v.title) && h.mentions(v.title, file);
      return notCase ? (!sees && v.login > 0) : sees;
    }, async (v) => ({
      message: notCase ? `A visitor still sees the file with the link: the page is "${v.title}".` : `A visitor does not see the file "${file}" with the link: the page is "${v.title}".`,
      hint: notCase ? 'A destroyed link leads to the login form.' : 'The link of the share dialog opens the view mode for anyone, no account needed.',
    }), h.budget(this) * 2);
  } finally {
    await context.close().catch(() => {});
  }
});

/**
 * Go back from the view mode to the dashboard of the file's team with the logo at the top left.
 *
 * Example #1: When I go back to the dashboard from the view mode
 * Example #2: When we go back to the dashboard from the view mode
 * Example #3: And I go back to the dashboard from the view mode
 * Example #4: Then I go back to the dashboard from the view mode
 * Example #5: When I go back to the dashboard from the view mode
 */
When(/^(?:I|we) go back to the dashboard from the view mode$/, { timeout: 60000 }, async function () {
  const page = this.page;
  await inViewer(this);
  await page.getByTestId('penpot-logo-link').click();
  await page.waitForURL((url) => /screen=dashboard/.test(url.search), { timeout: h.budget(this) * 2 }).catch(() => {});
  await h.settle(page, h.budget(this));
});
