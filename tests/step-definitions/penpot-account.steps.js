'use strict';

// The account: the menu of the profile and its submenus, the release notes,
// the pages of the account (profile, password, notifications, shortcuts,
// settings) and what they show.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/** Open the menu of the profile (the button with the account's name at the bottom of the side bar) when it is closed. */
async function profileMenu(world) {
  const page = world.page;
  if (await page.getByRole('menu').filter({ visible: true }).getByRole('menuitem', { name: /^Logout$/ }).count()) return;
  const button = await h.profileButton(world, page);
  if (!(await button.count())) throw friendly({ message: `Nobody is logged in: ${await h.pageSummary(page)}.`, hint: 'Log in first: Given I am a logged in user with the "editor" user.' });
  await button.click();
  await page.getByRole('menu').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: h.budget(world) });
}

/** An item of the profile menu or of one of its submenus by its words. */
function profileItem(page, words) {
  return page.getByRole('menuitem', { name: new RegExp(`^\\s*${h.escapeRegExp(words)}(\\s|$)`, 'i') }).filter({ visible: true }).first();
}

/**
 * Open the menu of the profile (the button with the account's name at the bottom of the dashboard's side bar).
 *
 * Example #1: When I open the profile menu
 * Example #2: When we open the profile menu
 * Example #3: And I open the profile menu
 * Example #4: Then I open the profile menu
 * Example #5: When I open the profile menu
 */
When(/^(?:I|we) open the profile menu$/, { timeout: 60000 }, async function () {
  await profileMenu(this);
});

/**
 * Point at an item of the profile menu: an item with a submenu ("Help & Learning", "Community & Contributions", "About
 * Penpot …") opens it.
 *
 * Example #1: When I point at "Help & Learning" in the profile menu
 * Example #2: When I point at "Community & Contributions" in the profile menu
 * Example #3: And I point at "About" in the profile menu
 * Example #4: When we point at "Your account" in the profile menu
 * Example #5: When I point at "Help & Learning" in the profile menu
 */
When(/^(?:I|we) point at "([^"]*)" in the profile menu$/, { timeout: 60000 }, async function (words) {
  const page = this.page;
  await profileMenu(this);
  const item = profileItem(page, words);
  if (!(await item.count())) throw friendly({ message: `The profile menu has no "${words}". It offers ${h.listed(await h.openMenuItems(page))}.`, hint: 'Name the item as it is written; an item of a submenu shows once its parent is pointed at.' });
  await item.hover();
  await page.waitForTimeout(400);
});

/**
 * Choose an item of the profile menu or of its open submenu ("Your account", "Logout", "Version … notes").
 *
 * Example #1: When I choose "Your account" in the profile menu
 * Example #2: When I choose "Version 2.19.4 notes" in the profile menu
 * Example #3: And I choose "Your account" in the profile menu
 * Example #4: When we choose "Your account" in the profile menu
 * Example #5: When I choose "Version 2.19.4 notes" in the profile menu
 */
When(/^(?:I|we) choose "([^"]*)" in the profile menu$/, { timeout: 60000 }, async function (words) {
  const page = this.page;
  await profileMenu(this);
  const item = profileItem(page, words);
  if (!(await item.count())) throw friendly({ message: `The profile menu has no "${words}". It offers ${h.listed(await h.openMenuItems(page))}.`, hint: 'Point at the item of the submenu\'s parent first (When I point at "About" in the profile menu).' });
  await item.click();
  await h.settle(page, h.budget(this));
});

/**
 * Assert what the profile menu and its open submenu offer, or that an item is not there.
 *
 * Example #1: Then the profile menu should offer "Help Center"
 * Example #2: Then the profile menu should offer "Penpot Changelog"
 * Example #3: And the profile menu should not offer "Help Center"
 * Example #4: Then the profile menu should offer "Your account"
 * Example #5: Then the profile menu should offer "Github repository"
 */
Then(/^the profile menu should( not)? offer "([^"]*)"$/, async function (notCase, words) {
  const page = this.page;
  await h.eventually(page, () => profileItem(page, words).count(), (n) => (n > 0) === !notCase, async () => ({
    message: `The profile menu ${notCase ? 'offers' : 'does not offer'} "${words}". It offers ${h.listed(await h.openMenuItems(page))}.`,
    hint: 'A submenu opens when its parent is pointed at, and closes when another item is.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Assert what the release notes on show say (their first page names the version), or a part of it.
 *
 * Example #1: Then the release notes should show "Version 2.19"
 * Example #2: Then the release notes should show "What’s new in Penpot?"
 * Example #3: And the release notes should show "Version 2.19"
 * Example #4: Then the release notes should show "Version 2.19"
 * Example #5: Then the release notes should show "new in"
 */
Then(/^the release notes should show "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const read = async () => h.clean(await page.locator('.relnotes').first().innerText({ timeout: 1000 }).catch(() => ''));
  await h.eventually(page, read, (t) => h.mentions(t, expected), async (t) => ({
    message: t ? `The release notes do not show "${expected}". They show "${t.slice(0, 200)}".` : 'No release notes are on show.',
    hint: 'The release notes open from the profile menu (About › Version … notes).',
  }), h.budget(this));
});

/**
 * Go through the release notes to their end ("Continue" on each page, then the last button), so they close.
 *
 * Example #1: When I read the release notes to the end
 * Example #2: When we read the release notes to the end
 * Example #3: And I read the release notes to the end
 * Example #4: Then I read the release notes to the end
 * Example #5: When I read the release notes to the end
 */
When(/^(?:I|we) read the release notes to the end$/, { timeout: 90000 }, async function () {
  const page = this.page;
  const notes = page.locator('.relnotes').first();
  for (let i = 0; i < 12 && (await notes.count()); i += 1) {
    const buttons = notes.locator('button').filter({ visible: true }).filter({ hasText: /\S/ });
    const n = await buttons.count();
    if (!n) break;
    await buttons.nth(n - 1).click();
    await page.waitForTimeout(400);
  }
  if (await notes.count()) throw friendly({ message: 'The release notes are still on show.', hint: 'Each page has "Continue"; the last one closes them.' });
});

/**
 * Go to a page of the account ("Profile", "Password", "Notifications", "Shortcuts", "Settings") from its side bar,
 * through "Your account" of the profile menu when the account's pages are not open.
 *
 * Example #1: When I go to "Settings" in my account
 * Example #2: When I go to "Shortcuts" in my account
 * Example #3: And I go to "Password" in my account
 * Example #4: When we go to "Profile" in my account
 * Example #5: When I go to "Notifications" in my account
 */
When(/^(?:I|we) go to "([^"]*)" in my account$/, { timeout: 60000 }, async function (section) {
  const page = this.page;
  if (!/^settings/.test(h.screenOf(page))) {
    await profileMenu(this);
    await profileItem(page, 'Your account').click();
    await page.waitForURL((url) => /screen=settings/.test(url.search), { timeout: h.budget(this) }).catch(() => {});
  }
  const nav = page.getByRole('navigation', { name: 'Settings' });
  await nav.waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  const item = nav.locator('li').filter({ hasText: h.exactly(section) }).first();
  if (!(await item.count())) throw friendly({ message: `The account has no page "${section}". Its side bar offers ${h.listed(await nav.locator('li').allInnerTexts())}.`, hint: 'The pages are Profile, Password, Notifications, Shortcuts, Settings and Release notes.' });
  await item.click();
  await h.settle(page, h.budget(this));
});

/**
 * Assert a setting of the account's page "Settings" by its heading ("Language", "UI theme"): the choice its list shows.
 *
 * Example #1: Then the setting "UI theme" should be "Penpot Dark (default)"
 * Example #2: Then the setting "Language" should be "Auto (browser)"
 * Example #3: And the setting "UI theme" should be "Penpot Dark (default)"
 * Example #4: Then the setting "Language" should be "English"
 * Example #5: Then the setting "UI theme" should be "Penpot Light"
 */
Then(/^the setting "([^"]*)" should be "([^"]*)"$/, async function (name, expected) {
  const page = this.page;
  const box = page.getByRole('heading', { name: h.exactly(name) }).locator('xpath=following::*[@role="combobox"][1]');
  const read = async () => h.clean(await box.first().innerText().catch(() => ''));
  await h.eventually(page, read, (v) => h.normal(v) === h.normal(expected), async (v) => ({
    message: v ? `The setting "${name}" is "${v}", not "${expected}".` : `The page has no setting "${name}": ${await h.pageSummary(page)}.`,
    hint: 'The settings are on the account\'s page "Settings" (When I go to "Settings" in my account).',
  }), h.budget(this));
});

/**
 * Search the shortcuts of the account's page "Shortcuts" ("Search shortcuts").
 *
 * Example #1: When I search the shortcuts for "Rectangle"
 * Example #2: When we search the shortcuts for "Board"
 * Example #3: And I search the shortcuts for "Undo"
 * Example #4: When I search the shortcuts for "Zoom"
 * Example #5: When I search the shortcuts for "nothing like this"
 */
When(/^(?:I|we) search the shortcuts for "([^"]*)"$/, { timeout: 60000 }, async function (text) {
  const page = this.page;
  const box = page.getByRole('textbox', { name: 'Search shortcuts' });
  if (!(await box.count())) throw friendly({ message: `The page has no search of shortcuts: ${await h.pageSummary(page)}.`, hint: 'Go to the shortcuts first: When I go to "Shortcuts" in my account.' });
  await box.fill(text);
  await page.waitForTimeout(500);
});

/**
 * Assert that the shortcuts listed (by the tab on show and the search) include an action, or do not.
 *
 * Example #1: Then the shortcuts should list "Rectangle"
 * Example #2: Then the shortcuts should not list "Ellipse"
 * Example #3: And the shortcuts should list "Board"
 * Example #4: Then the shortcuts should list "Undo"
 * Example #5: But the shortcuts should not list "Rectangle"
 */
Then(/^the shortcuts should( not)? list "([^"]*)"$/, async function (notCase, action) {
  const page = this.page;
  const read = async () => (await page.getByRole('region', { name: 'Shortcuts page' }).innerText().catch(() => '')).split('\n').map(h.clean).filter(Boolean);
  await h.eventually(page, read, (lines) => lines.some((l) => h.normal(l) === h.normal(action)) === !notCase, async (lines) => ({
    message: `The shortcuts ${notCase ? 'list' : 'do not list'} "${action}". They show ${h.listed(lines.slice(0, 30))}.`,
    hint: 'The tab "All" lists every shortcut; "Custom" those the account changed; the search narrows them.',
  }), notCase ? 3000 : h.budget(this));
});
