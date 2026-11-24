'use strict';

// The history of a file (versions saved, restored) and what the site gives
// back as files: the boards as PDF, the file itself, an image of a board;
// with checks of the downloaded PDF and image.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/** Open the History panel of the workspace (the button "History" at the top right) on its tab "History". */
async function historyPanel(world) {
  const page = world.page;
  await h.inWorkspace(world);
  const panel = page.getByRole('tabpanel', { name: 'History' });
  if (!(await panel.count())) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByRole('button', { name: 'History', exact: true }).first().click();
  }
  const tab = page.getByTestId('right-sidebar').getByRole('tab', { name: 'History' });
  if ((await tab.count()) && (await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await panel.waitFor({ state: 'visible', timeout: h.budget(world) });
  return panel;
}

/** The names of the versions the History panel lists. */
async function versionNames(panel) {
  return panel.getByRole('listitem').evaluateAll((items) => items.map((li) => {
    const lines = (li.innerText || '').split('\n').map((t) => t.trim()).filter(Boolean);
    return lines[0] || '';
  })).catch(() => []);
}

/**
 * Save a version of the open file with a name: the History panel, "Save version", the name typed in, Enter.
 *
 * Example #1: When I save a version named "Webship test version"
 * Example #2: When we save a version named "Webship test before"
 * Example #3: And I save a version named "Webship test version"
 * Example #4: When I save a version named "Webship test first"
 * Example #5: When I save a version named "Webship test version"
 */
When(/^(?:I|we) save a version named "([^"]*)"$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  const panel = await historyPanel(this);
  await panel.getByRole('button', { name: 'Save version' }).click();
  const input = page.getByTestId('right-sidebar').getByRole('textbox').filter({ visible: true }).first();
  await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  await input.fill(name);
  await input.press('Enter');
  await h.eventually(page, () => versionNames(panel), (names) => names.some((n) => h.normal(n) === h.normal(name)), async (names) => ({ message: `The version "${name}" was not saved. The history lists ${h.listed(names)}.`, hint: 'A viewer cannot save versions.' }), h.budget(this));
});

/**
 * Assert that the History panel of the open file lists a version, or does not.
 *
 * Example #1: Then the history should list the version "Webship test version"
 * Example #2: Then the history should not list the version "Webship test version"
 * Example #3: And the history should list the version "Webship test before"
 * Example #4: Then the history should list the version "Webship test first"
 * Example #5: But the history should not list the version "Webship test first"
 */
Then(/^the history should( not)? list the version "([^"]*)"$/, { timeout: 60000 }, async function (notCase, name) {
  const page = this.page;
  const panel = await historyPanel(this);
  await h.eventually(page, () => versionNames(panel), (names) => names.some((n) => h.normal(n) === h.normal(name)) === !notCase, async (names) => ({
    message: `The history ${notCase ? 'lists' : 'does not list'} the version "${name}". It lists ${h.listed(names)}.`,
    hint: 'Versions saved by hand are listed with their names; the autosaved ones with their dates.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Restore a version of the open file: its menu in the History panel, "Restore", then "Restore" in the bar that asks.
 * The file goes back to what it was then.
 *
 * Example #1: When I restore the version "Webship test version"
 * Example #2: When we restore the version "Webship test before"
 * Example #3: And I restore the version "Webship test version"
 * Example #4: When I restore the version "Webship test first"
 * Example #5: When I restore the version "Webship test version"
 */
When(/^(?:I|we) restore the version "([^"]*)"$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  const panel = await historyPanel(this);
  const item = panel.getByRole('listitem').filter({ hasText: name }).first();
  await h.eventually(page, () => item.count(), (n) => n > 0, async () => ({ message: `The history has no version "${name}". It lists ${h.listed(await versionNames(panel))}.`, hint: 'Save one first: When I save a version named "…".' }), h.budget(this));
  await item.hover();
  await item.getByRole('button', { name: 'Open version menu' }).click();
  await panel.getByRole('button', { name: 'Restore', exact: true }).click();
  const bar = page.getByRole('complementary').filter({ hasText: 'Do you want to restore this version?' });
  await bar.waitFor({ state: 'visible', timeout: h.budget(this) });
  await bar.getByRole('button', { name: 'Restore' }).click();
  await bar.waitFor({ state: 'hidden', timeout: h.budget(this) * 2 }).catch(() => {});
  await h.settle(page, h.budget(this));
});

/**
 * Press a button of the open dialog that downloads a file ("Export" of the PDF export): the file is kept for
 * webship-js's download steps ("the downloaded file name should be …").
 *
 * Example #1: When I press "Export" in the dialog to download a file
 * Example #2: When we press "Export" in the dialog to download a file
 * Example #3: And I press "Export" in the dialog to download a file
 * Example #4: When I press "Export" in the dialog to download a file
 * Example #5: When I press "Download" in the dialog to download a file
 */
When(/^(?:I|we) press "([^"]*)" in the dialog to download a file$/, { timeout: 180000 }, async function (words) {
  const page = this.page;
  const control = await h.dialogControl(page, words);
  if (!control) throw friendly({ message: `The dialog has no button "${words}". It offers ${h.listed(await h.dialogControls(page))}.`, hint: 'Open the dialog first (When I choose "Export boards as PDF" in the main menu "File").' });
  await h.captureDownload(this, page, () => control.click(), `"${words}" of the dialog`);
});

/**
 * Press a button of the page that downloads a file ("Export 1 element" of the view mode's inspect): the file is kept
 * for webship-js's download steps.
 *
 * Example #1: When I press the button "Export 1 element" to download a file
 * Example #2: When we press the button "Export 1 element" to download a file
 * Example #3: And I press the button "Export 1 element" to download a file
 * Example #4: When I press the button "Export 2 elements" to download a file
 * Example #5: When I press the button "Export 1 element" to download a file
 */
When(/^(?:I|we) press the button "([^"]*)" to download a file$/, { timeout: 180000 }, async function (words) {
  const page = this.page;
  const button = page.getByRole('button', { name: h.exactly(words) }).filter({ visible: true }).first();
  if (!(await button.count())) throw friendly({ message: `The page has no button "${words}": ${await h.pageSummary(page)}.`, hint: 'In the view mode\'s inspect, "Add export" comes first.' });
  await h.captureDownload(this, page, () => button.click(), `"${words}"`);
});

/**
 * Download the open file as a file of the site's own format, from the main menu (File, the download of the file):
 * the file is kept for webship-js's download steps, and the dialog the site shows is closed.
 *
 * Example #1: When I download the open file
 * Example #2: When we download the open file
 * Example #3: And I download the open file
 * Example #4: Then I download the open file
 * Example #5: When I download the open file
 */
When(/^(?:I|we) download the open file$/, { timeout: 180000 }, async function () {
  const page = this.page;
  const items = await h.mainMenuItems(this, 'File');
  const label = items.find((i) => /^download .*file/i.test(i));
  if (!label) {
    await page.keyboard.press('Escape');
    throw friendly({ message: `The main menu "File" offers no download of the file. It offers ${h.listed(items)}.`, hint: 'The download of the file is in the File menu of the workspace.' });
  }
  const item = page.locator('#file-menu-binary-file').or(page.locator('ul[class*="menu"] > li').filter({ hasText: label })).first();
  await h.captureDownload(this, page, () => item.click(), 'The download of the file');
  if (await h.dialog(page).count()) {
    const close = await h.dialogControl(page, 'Close');
    if (close) await close.click(); else await page.keyboard.press('Escape');
  }
});

/**
 * Assert that the downloaded file is a PDF of a number of pages (the PDF export makes a page of each board).
 *
 * Example #1: Then the downloaded file should be a PDF of 1 page
 * Example #2: Then the downloaded file should be a PDF of 2 pages
 * Example #3: And the downloaded file should be a PDF of 2 pages
 * Example #4: Then the downloaded file should be a PDF of 3 pages
 * Example #5: Then the downloaded file should be a PDF of 1 page
 */
Then(/^the downloaded file should be a PDF of (\d+) pages?$/, async function (count) {
  const download = this._lastDownload;
  if (!download) throw friendly({ message: 'No file was downloaded.', hint: 'Download one first (When I press "Export" in the dialog to download a file).' });
  const content = download.content;
  if (content.slice(0, 5).toString('latin1') !== '%PDF-') {
    throw friendly({ message: `The downloaded file "${download.filename}" is not a PDF (it starts with "${content.slice(0, 8).toString('latin1')}").`, hint: 'The PDF export of the boards gives a PDF.' });
  }
  const pages = (content.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g) || []).length;
  if (pages !== Number(count)) {
    throw friendly({ message: `The downloaded PDF "${download.filename}" has ${pages} page(s), not ${count}.`, hint: 'The export makes a page of each board ticked in its dialog.' });
  }
});

/**
 * Assert that the downloaded file is a PNG image of a size in pixels (an export of a board at 1x).
 *
 * Example #1: Then the downloaded file should be a PNG image of 300 by 200 pixels
 * Example #2: Then the downloaded file should be a PNG image of 300 by 60 pixels
 * Example #3: And the downloaded file should be a PNG image of 300 by 200 pixels
 * Example #4: Then the downloaded file should be a PNG image of 220 by 140 pixels
 * Example #5: Then the downloaded file should be a PNG image of 120 by 80 pixels
 */
Then(/^the downloaded file should be a PNG image of (\d+) by (\d+) pixels$/, async function (width, height) {
  const download = this._lastDownload;
  if (!download) throw friendly({ message: 'No file was downloaded.', hint: 'Download one first (When I press the button "Export 1 element" to download a file).' });
  const content = download.content;
  const signature = content.slice(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw friendly({ message: `The downloaded file "${download.filename}" is not a PNG image.`, hint: 'An export of the type PNG gives a PNG image.' });
  }
  const w = content.readUInt32BE(16);
  const hgt = content.readUInt32BE(20);
  if (w !== Number(width) || hgt !== Number(height)) {
    throw friendly({ message: `The downloaded image "${download.filename}" is ${w} by ${hgt} pixels, not ${width} by ${height}.`, hint: 'An export at 1x keeps the size of the board.' });
  }
});
