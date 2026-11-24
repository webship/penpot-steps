'use strict';

// The dashboard: a team and the sections of its side bar, its projects (made,
// renamed, pinned, deleted) and their files (made, renamed, selected, deleted,
// found by the search), the trash, the menus of a card, and the answers of
// the site (its messages, its dialogs).

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/** Open the options of a project's card: its "…" button (hovered first, as a person does), or a right click on its name. */
async function projectMenu(world, name, { rightClick = false } = {}) {
  const page = world.page;
  await h.onDashboard(world);
  const card = h.projectCard(page, name);
  if (!(await card.count())) {
    throw friendly({ message: `The dashboard shows no project "${name}". It shows ${h.listed((await h.projectCards(page)).map((c) => c.name))}.`, hint: 'Open the team the project is in first (When I open the team "Design team").' });
  }
  if (rightClick) {
    await card.getByRole('heading', { level: 2, name: h.exactly(name) }).click({ button: 'right' });
  } else {
    await card.hover();
    await card.getByTestId('project-options').first().click();
  }
  await page.getByRole('menu').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: h.budget(world) }).catch(() => {});
}

/** Open the menu of a file's card: a right click on it, else its "Options" button (the cards of the libraries have one). */
async function fileMenu(world, name, { rightClick = true } = {}) {
  const page = world.page;
  await h.onDashboard(world);
  const card = h.fileCard(page, name);
  if (!(await card.count())) {
    throw friendly({ message: `The screen shows no file "${name}". It shows ${h.listed(await h.fileTitles(page))}.`, hint: 'The files are on the cards of their projects; the drafts under Drafts, the shared libraries under Libraries.' });
  }
  if (rightClick) await card.click({ button: 'right' });
  const menu = page.getByRole('menu').filter({ visible: true }).first();
  await menu.waitFor({ state: 'visible', timeout: rightClick ? 3000 : 100 }).catch(() => {});
  if (!(await menu.count())) {
    await card.hover();
    const options = card.getByRole('button', { name: 'Options' });
    if (await options.count()) await options.first().click();
    await menu.waitFor({ state: 'visible', timeout: h.budget(world) }).catch(() => {});
  }
}

/**
 * Open the dashboard of a team the account is in, by its name ("Personal Projects" for the account's own): the
 * projects of the team. The team is the one the steps after work in.
 *
 * Example #1: When I open the team "Design team"
 * Example #2: When we open the team "Personal Projects"
 * Example #3: And I open the team "Design team"
 * Example #4: Given I open the team "Design team"
 * Example #5: When I open the team "Webship test team"
 */
When(/^(?:I|we) open the team "([^"]*)"$/, { timeout: 90000 }, async function (name) {
  await h.openTeam(this, name);
});

/**
 * Go to a section of the dashboard's side bar: "Projects", "Drafts", "Fonts" or "Libraries".
 *
 * Example #1: When I go to "Drafts" in the dashboard
 * Example #2: When we go to "Libraries" in the dashboard
 * Example #3: And I go to "Projects" in the dashboard
 * Example #4: When I go to "Fonts" in the dashboard
 * Example #5: When I go to "Drafts" in the dashboard
 */
When(/^(?:I|we) go to "([^"]*)" in the dashboard$/, { timeout: 60000 }, async function (section) {
  const page = this.page;
  await h.onDashboard(this);
  const items = page.getByTestId('dashboard-sidebar').locator('li');
  const item = items.filter({ hasText: h.exactly(section) }).first();
  if (!(await item.count())) {
    throw friendly({ message: `The dashboard has no section "${section}". Its side bar offers ${h.listed(await items.allInnerTexts())}.`, hint: 'The sections are Projects, Drafts, Fonts and Libraries, then the pinned projects.' });
  }
  await item.click();
  await h.settle(page, h.budget(this));
  await h.eventually(page, () => h.heading(page), (t) => !!t, async () => ({ message: `The section "${section}" did not open: ${await h.pageSummary(page)}.`, hint: 'Each section has its heading.' }), h.budget(this));
  await h.hideTemplates(page);
});

/**
 * Assert the heading of the screen (its first visible h1): "Projects", "Drafts", "Libraries", "Fonts", "Members",
 * "Search results", "Your account".
 *
 * Example #1: Then the page heading should be "Projects"
 * Example #2: Then the page heading should be "Drafts"
 * Example #3: And the page heading should be "Members"
 * Example #4: Then the page heading should be "Search results"
 * Example #5: Then the page heading should be "Personal Projects"
 */
Then(/^the page heading should be "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await h.eventually(page, () => h.heading(page), (text) => h.normal(text) === h.normal(expected), async (text) => ({
    message: `The page heading is "${text || '(none)'}", not "${expected}".`,
    hint: 'The heading is the first visible h1 of the screen.',
  }), h.budget(this));
});

/**
 * Assert that the dashboard shows a project's card, or does not.
 *
 * Example #1: Then the dashboard should show the project "Website redesign"
 * Example #2: Then the dashboard should not show the project "Webship test project"
 * Example #3: And the dashboard should show the project "Brand"
 * Example #4: Then the dashboard should show the project "Drafts"
 * Example #5: But the dashboard should not show the project "Webship test renamed project"
 */
Then(/^the dashboard should( not)? show the project "([^"]*)"$/, async function (notCase, name) {
  const page = this.page;
  await h.onDashboard(this);
  await h.eventually(page, () => h.projectCards(page), (cards) => cards.some((c) => h.normal(c.name) === h.normal(name)) === !notCase, async (cards) => ({
    message: `The dashboard ${notCase ? 'shows' : 'does not show'} the project "${name}". It shows ${h.listed(cards.map((c) => c.name))}.`,
    hint: notCase ? 'A deleted project leaves the dashboard at once.' : 'The projects are those of the team that is open (When I open the team "Design team").',
  }), h.budget(this));
});

/**
 * Assert that a project's card lists a file, or does not.
 *
 * Example #1: Then the project "Website redesign" should list the file "Homepage"
 * Example #2: Then the project "Website redesign" should not list the file "Webship test file"
 * Example #3: And the project "Brand" should list the file "Style guide"
 * Example #4: Then the project "Drafts" should list the file "Sketches"
 * Example #5: Then the project "Webship test project" should list the file "Webship test file"
 */
Then(/^the project "([^"]*)" should( not)? list the file "([^"]*)"$/, async function (project, notCase, file) {
  const page = this.page;
  await h.onDashboard(this);
  await h.eventually(page, () => h.projectCards(page), (cards) => {
    const card = cards.find((c) => h.normal(c.name) === h.normal(project));
    return !!card && card.files.some((f) => h.normal(f) === h.normal(file)) === !notCase;
  }, async (cards) => {
    const card = cards.find((c) => h.normal(c.name) === h.normal(project));
    return {
      message: card ? `The project "${project}" ${notCase ? 'lists' : 'does not list'} the file "${file}". It lists ${h.listed(card.files)}.` : `The dashboard shows no project "${project}". It shows ${h.listed(cards.map((c) => c.name))}.`,
      hint: 'A project\'s card shows its latest files; the drafts are the files of the project "Drafts".',
    };
  }, h.budget(this));
});

/**
 * Make a project in the team that is open: "+ New project", its name typed in place of "New Project 1", Enter.
 *
 * Example #1: When I create the project "Webship test project"
 * Example #2: When we create the project "Webship test campaign"
 * Example #3: And I create the project "Webship test project"
 * Example #4: When I create the project "Webship test brand"
 * Example #5: When I create the project "Webship test project"
 */
When(/^(?:I|we) create the project "([^"]*)"$/, { timeout: 60000 }, async function (name) {
  const page = this.page;
  await h.onDashboard(this);
  const button = page.getByTestId('new-project-button');
  if (!(await button.count())) {
    throw friendly({ message: `The dashboard offers no "+ New project": ${await h.pageSummary(page)}.`, hint: 'A viewer of a team cannot make a project; an editor, an admin and the owner can.' });
  }
  await button.click();
  const input = page.locator('input[class*="inline_edition__element-title"]').filter({ visible: true }).first();
  await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  await input.fill(name);
  await input.press('Enter');
  await h.projectCard(page, name).waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
});

/**
 * Rename a project: "Rename" in the options of its card, the new name typed in place of the old one, Enter.
 *
 * Example #1: When I rename the project "Webship test project" to "Webship test renamed project"
 * Example #2: When we rename the project "Webship test project" to "Webship test brand"
 * Example #3: And I rename the project "Webship test brand" to "Webship test project"
 * Example #4: When I rename the project "Webship test project" to "Webship test 2"
 * Example #5: When I rename the project "Webship test 2" to "Webship test project"
 */
When(/^(?:I|we) rename the project "([^"]*)" to "([^"]*)"$/, { timeout: 60000 }, async function (from, to) {
  const page = this.page;
  await projectMenu(this, from);
  await h.chooseInMenu(this, 'Rename');
  const input = page.locator('input[class*="inline_edition__element-title"]').filter({ visible: true }).first();
  await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  await input.fill(to);
  await input.press('Enter');
  await h.projectCard(page, to).waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
});

/**
 * Open the menu of a project or of a file on the dashboard: its "…" button ("Options"), or a right click on it. The
 * menu stays open for the steps after it ("Then the menu should offer …", "When I choose … in the menu").
 *
 * Example #1: When I open the options of the project "Website redesign"
 * Example #2: When I right-click the project "Brand"
 * Example #3: And I open the options of the file "Style guide"
 * Example #4: When I right-click the file "Homepage"
 * Example #5: When we open the options of the project "Drafts"
 */
When(/^(?:I|we) (open the options of|right-click) the (project|file) "([^"]*)"$/, { timeout: 60000 }, async function (how, kind, name) {
  const rightClick = how === 'right-click';
  if (kind === 'project') await projectMenu(this, name, { rightClick });
  else await fileMenu(this, name, { rightClick });
});

/**
 * Assert what the open menu offers, or that it does not offer an item (a viewer's menus hold fewer; the team's drafts
 * cannot be renamed or deleted).
 *
 * Example #1: Then the menu should offer "Rename"
 * Example #2: Then the menu should not offer "Delete"
 * Example #3: And the menu should offer "Add as Shared Library"
 * Example #4: Then the menu should offer "Delete 2 files"
 * Example #5: Then the menu should offer "Personal Projects"
 */
Then(/^the menu should( not)? offer "([^"]*)"$/, async function (notCase, words) {
  const page = this.page;
  const items = await h.eventually(page, () => h.openMenuItems(page), (list) => list.length > 0 && list.some((i) => h.normal(i) === h.normal(words)) === !notCase, async (list) => ({
    message: list.length ? `The menu ${notCase ? 'offers' : 'does not offer'} "${words}". It offers ${h.listed(list)}.` : 'No menu is open.',
    hint: 'Open a menu first (When I open the options of the project "…", When I right-click the file "…"); what it offers follows the role of the account.',
  }), notCase ? 2000 : h.budget(this));
  return items;
});

/**
 * Choose an item of the open menu by its words; an item that holds a menu of its own ("Move to") opens it.
 *
 * Example #1: When I choose "Rename" in the menu
 * Example #2: When I choose "Move to" in the menu
 * Example #3: And I choose "Delete 2 files" in the menu
 * Example #4: When we choose "Duplicate" in the menu
 * Example #5: When I choose "Pin/Unpin" in the menu
 */
When(/^(?:I|we) choose "([^"]*)" in the menu$/, { timeout: 60000 }, async function (words) {
  await h.chooseInMenu(this, words);
});

/**
 * Choose an action of a project's options or of a file's menu: "Rename", "Duplicate", "Pin/Unpin", "Move to",
 * "Delete", "Add as Shared Library". A delete asks first: answer with the step of the dialog.
 *
 * Example #1: When I choose "Delete" in the options of the project "Webship test project"
 * Example #2: When I choose "Delete" in the options of the file "Webship test file"
 * Example #3: And I choose "Duplicate" in the options of the file "Webship test file"
 * Example #4: When I choose "Pin/Unpin" in the options of the project "Webship test project"
 * Example #5: When we choose "Add as Shared Library" in the options of the file "Webship test file"
 */
When(/^(?:I|we) choose "([^"]*)" in the options of the (project|file) "([^"]*)"$/, { timeout: 60000 }, async function (action, kind, name) {
  if (kind === 'project') await projectMenu(this, name);
  else await fileMenu(this, name);
  await h.chooseInMenu(this, action);
});

/**
 * Assert the actions the options of a project or the menu of a file offer, or that one is not offered; the menu is
 * closed again after.
 *
 * Example #1: Then the options of the project "Website redesign" should offer "Rename"
 * Example #2: Then the options of the project "Drafts" should not offer "Delete"
 * Example #3: And the options of the file "Homepage" should offer "Duplicate"
 * Example #4: Then the options of the file "Homepage" should not offer "Delete"
 * Example #5: Then the options of the file "Style guide" should offer "Unpublish Library"
 */
Then(/^the options of the (project|file) "([^"]*)" should( not)? offer "([^"]*)"$/, { timeout: 60000 }, async function (kind, name, notCase, action) {
  const page = this.page;
  if (kind === 'project') await projectMenu(this, name);
  else await fileMenu(this, name);
  const items = await h.eventually(page, () => h.openMenuItems(page), (list) => list.length > 0, async () => ({ message: `No menu opened for the ${kind} "${name}".`, hint: 'A viewer may have no actions on a card at all.' }), 3000).catch(() => []);
  await page.keyboard.press('Escape');
  const has = items.some((i) => h.normal(i) === h.normal(action));
  if (has === !!notCase) {
    throw friendly({ message: `The options of the ${kind} "${name}" ${notCase ? 'offer' : 'do not offer'} "${action}". They offer ${h.listed(items)}.`, hint: 'What a menu offers follows the role of the account in the team.' });
  }
});

/**
 * Assert the message the site answered with ("Your file has been deleted successfully", "Invitation sent
 * successfully"), or a part of it: the message at the bottom of the page, recorded as it came.
 *
 * Example #1: Then the site should say "Your project has been deleted successfully"
 * Example #2: Then the site should say "Your file has been deleted successfully"
 * Example #3: And the site should say "Invitation sent successfully"
 * Example #4: Then the site should say "Team created successfully"
 * Example #5: Then the site should say "Password recovery link sent to your inbox."
 */
Then(/^the site should say "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await h.eventually(page, () => h.messages(page), (m) => m.some((x) => h.mentions(x.text, expected)), async (m) => ({
    message: `The site did not say "${expected}". It said ${h.listed(m.map((x) => x.text))}.`,
    hint: 'The site answers an action with a message that goes after a few seconds; the pack records each one as it comes.',
  }), h.budget(this));
});

/**
 * Assert the question of the dialog the site asks before it acts ("Are you sure you want to delete this file?"), or a
 * part of it.
 *
 * Example #1: Then the site should ask "Are you sure you want to delete this file?"
 * Example #2: Then the site should ask "Are you sure you want to delete this project?"
 * Example #3: And the site should ask "Are you sure you want to delete this team?"
 * Example #4: Then the site should ask "Are you sure you want to remove this link?"
 * Example #5: Then the site should ask "Do you want to restore this version?"
 */
Then(/^the site should ask "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const read = async () => {
    const parts = [await h.dialogText(page)];
    parts.push(...(await page.getByRole('complementary').filter({ visible: true }).allInnerTexts().catch(() => [])));
    return h.clean(parts.join(' '));
  };
  await h.eventually(page, read, (text) => h.mentions(text, expected), async (text) => ({
    message: text ? `The site does not ask "${expected}". It says "${text.slice(0, 300)}".` : `The site asks nothing: ${await h.pageSummary(page)}.`,
    hint: 'A delete asks first in a dialog with its question; the restore of a version asks in a bar at the top.',
  }), h.budget(this));
});

/**
 * Assert what the open dialog says, or that it does not say a text ("2 of 2 elements selected", "Some members are
 * already on the team").
 *
 * Example #1: Then the dialog should say "2 of 2 elements selected"
 * Example #2: Then the dialog should say "Some members are already on the team. We'll invite the rest."
 * Example #3: And the dialog should not say "Some members are already on the team"
 * Example #4: Then the dialog should say "Invalid color value: 1"
 * Example #5: Then the dialog should say "Anyone with link will have access"
 */
Then(/^the dialog should( not)? say "([^"]*)"$/, async function (notCase, expected) {
  const page = this.page;
  await h.eventually(page, () => h.dialogText(page), (text) => !!text && h.mentions(text, expected) === !notCase, async (text) => ({
    message: text ? `The dialog ${notCase ? 'says' : 'does not say'} "${expected}". It says "${text.slice(0, 300)}".` : `No dialog is open: ${await h.pageSummary(page)}.`,
    hint: 'A dialog opens from the action before it.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Assert that a button of the open dialog is enabled or disabled.
 *
 * Example #1: Then the button "Export" of the dialog should be disabled
 * Example #2: Then the button "Send invitation" of the dialog should be enabled
 * Example #3: And the button "Save" of the dialog should be disabled
 * Example #4: Then the button "Send invitation" of the dialog should be disabled
 * Example #5: Then the button "Export" of the dialog should be enabled
 */
Then(/^the button "([^"]*)" of the dialog should be (enabled|disabled)$/, async function (words, state) {
  const page = this.page;
  await h.eventually(page, async () => {
    const control = await h.dialogControl(page, words);
    if (!control) return 'missing';
    return (await control.isEnabled()) ? 'enabled' : 'disabled';
  }, (v) => v === state, async (v) => ({
    message: v === 'missing' ? `The dialog has no button "${words}". It offers ${h.listed(await h.dialogControls(page))}.` : `The button "${words}" of the dialog is ${v}, not ${state}.`,
    hint: 'A button of a dialog waits for what its form needs.',
  }), h.budget(this));
});

/**
 * Press a button of the open dialog by its words: "Delete file", "Delete project", "Cancel", "Send invitation",
 * "Export", or a board of the export's list.
 *
 * Example #1: When I press "Delete file" in the dialog
 * Example #2: When we press "Delete project" in the dialog
 * Example #3: And I press "Cancel" in the dialog
 * Example #4: When I press "Send invitation" in the dialog
 * Example #5: When I press "Hero" in the dialog
 */
When(/^(?:I|we) press "([^"]*)" in the dialog$/, { timeout: 90000 }, async function (words) {
  await h.pressInDialog(this, words);
});

/**
 * Close the open dialog as a person does with the keyboard (Escape).
 *
 * Example #1: When I close the dialog
 * Example #2: And I close the dialog
 * Example #3: When we close the dialog
 * Example #4: Then I close the dialog
 * Example #5: When I close the dialog
 */
When(/^(?:I|we) close the dialog$/, async function () {
  await this.page.keyboard.press('Escape');
  await h.settle(this.page, h.budget(this));
});

/**
 * Close the menus that are open as a person does with the keyboard (Escape), a submenu first.
 *
 * Example #1: When I close the menu
 * Example #2: And I close the menu
 * Example #3: When we close the menu
 * Example #4: Then I close the menu
 * Example #5: When I close the menu
 */
When(/^(?:I|we) close the menu$/, async function () {
  const page = this.page;
  for (let i = 0; i < 3 && (await h.openMenuItems(page)).length; i += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
});

/**
 * Assert that no dialog is open (the one of the action before closed).
 *
 * Example #1: Then no dialog should be open
 * Example #2: And no dialog should be open
 * Example #3: Then no dialog should be open
 * Example #4: But no dialog should be open
 * Example #5: Then no dialog should be open
 */
Then(/^no dialog should be open$/, async function () {
  const page = this.page;
  await h.eventually(page, () => h.dialog(page).count(), (n) => n === 0, async () => ({
    message: `A dialog is still open: "${(await h.dialogText(page)).slice(0, 200)}".`,
    hint: 'A dialog closes once the site took what it was sent.',
  }), h.budget(this));
});

/**
 * Make a file in a project of the team that is open: "+ New File" on its card. The workspace opens on the new file
 * ("New File 1"); its name is changed with the step that renames the file.
 *
 * Example #1: When I create a file in the project "Webship test project"
 * Example #2: When we create a file in the project "Webship test project"
 * Example #3: And I create a file in the project "Drafts"
 * Example #4: When I create a file in the project "Webship test project"
 * Example #5: When I create a file in the project "Webship test brand"
 */
When(/^(?:I|we) create a file in the project "([^"]*)"$/, { timeout: 90000 }, async function (project) {
  const page = this.page;
  await h.onDashboard(this);
  const card = h.projectCard(page, project);
  if (!(await card.count())) {
    throw friendly({ message: `The dashboard shows no project "${project}". It shows ${h.listed((await h.projectCards(page)).map((c) => c.name))}.`, hint: 'Open the team the project is in first.' });
  }
  await card.hover();
  const button = card.getByRole('button', { name: '+ New File' });
  if (!(await button.count())) {
    throw friendly({ message: `The project "${project}" offers no "+ New File".`, hint: 'A viewer of a team cannot make a file.' });
  }
  await button.click();
  await page.waitForURL((url) => /screen=workspace/.test(url.search), { timeout: h.budget(this) * 3 }).catch(() => {});
  await h.waitWorkspace(this);
});

/**
 * Open a file from the dashboard as a person does: a double click on its card. The workspace opens on it.
 *
 * Example #1: When I open the file "Homepage" from the dashboard
 * Example #2: When we open the file "Sketches" from the dashboard
 * Example #3: And I open the file "Style guide" from the dashboard
 * Example #4: When I open the file "Pricing page" from the dashboard
 * Example #5: When I open the file "Webship test file" from the dashboard
 */
When(/^(?:I|we) open the file "([^"]*)" from the dashboard$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  await h.onDashboard(this);
  const card = h.fileCard(page, name);
  if (!(await card.count())) {
    throw friendly({ message: `The screen shows no file "${name}". It shows ${h.listed(await h.fileTitles(page))}.`, hint: 'Go to the section the file is in first (its project on Projects, Drafts, Libraries).' });
  }
  await card.dblclick();
  await page.waitForURL((url) => /screen=workspace/.test(url.search), { timeout: h.budget(this) * 3 }).catch(() => {});
  await h.waitWorkspace(this);
});

/**
 * Rename a file: from the dashboard, "Rename" in its menu; in the workspace, a double click on its name at the top of
 * the left side bar. The new name typed in place of the old one, Enter.
 *
 * Example #1: When I rename the file "New File 1" to "Webship test file"
 * Example #2: When we rename the file "Webship test file" to "Webship test home"
 * Example #3: And I rename the file "Webship test home" to "Webship test file"
 * Example #4: When I rename the file "Webship test file" to "Webship test renamed file"
 * Example #5: When I rename the file "Webship test renamed file" to "Webship test file"
 */
When(/^(?:I|we) rename the file "([^"]*)" to "([^"]*)"$/, { timeout: 60000 }, async function (from, to) {
  const page = this.page;
  let input;
  if (h.screenOf(page) === 'workspace') {
    const name = page.locator('div[class$="left_header__file-name"]').first();
    const now = await name.getAttribute('title').catch(() => '');
    if (h.normal(now) !== h.normal(from)) {
      throw friendly({ message: `The workspace shows the file "${now || '(none)'}", not "${from}".`, hint: 'The file\'s name is at the top of the left side bar.' });
    }
    await name.dblclick();
    input = page.locator('input[class*="file-name-input"]').first();
  } else {
    await fileMenu(this, from);
    await h.chooseInMenu(this, 'Rename');
    input = page.locator('input[class*="inline_edition"], input:focus').filter({ visible: true }).first();
  }
  await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  await input.fill(to);
  await input.press('Enter');
  await h.settle(page, h.budget(this));
  if (h.screenOf(page) === 'workspace') {
    await h.eventually(page, () => page.title(), (t) => h.mentions(t, to), async (t) => ({ message: `The file was not renamed: the page's title is "${t}".`, hint: 'Enter saves the new name.' }), h.budget(this));
  }
});

/**
 * Select files on the screen as a person does: a click on the first, a click with Shift on each other.
 *
 * Example #1: When I select the files "Homepage" and "Pricing page"
 * Example #2: When we select the files "Webship test file" and "Webship test second file"
 * Example #3: And I select the files "Homepage" and "Pricing page"
 * Example #4: When I select the files "Sketches" and "Webship test file"
 * Example #5: When I select the files "Pricing page" and "Homepage"
 */
When(/^(?:I|we) select the files "([^"]*)" and "([^"]*)"$/, { timeout: 60000 }, async function (first, second) {
  const page = this.page;
  await h.onDashboard(this);
  // A menu that is open takes the first click to close itself: it goes first.
  for (let i = 0; i < 3 && (await h.openMenuItems(page)).length; i += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  const selected = async (card) => /is-selected/.test(String(await card.getAttribute('class').catch(() => '')));
  for (const [i, name] of [first, second].entries()) {
    const card = h.fileCard(page, name);
    if (!(await card.count())) {
      throw friendly({ message: `The screen shows no file "${name}". It shows ${h.listed(await h.fileTitles(page))}.`, hint: 'Both files must be on the screen.' });
    }
    // A click that only closed what a menu left behind selects nothing: the card is clicked again then.
    for (let attempt = 0; attempt < 3 && !(await selected(card)); attempt += 1) {
      await card.click(i ? { modifiers: ['Shift'] } : {});
      await page.waitForTimeout(200);
    }
    if (!(await selected(card))) {
      throw friendly({ message: `The file "${name}" did not get selected.`, hint: 'A click selects a file; a click with Shift adds one to the selection.' });
    }
  }
});

/**
 * Open the menu of the files that are selected: a right click on the first of them.
 *
 * Example #1: When I right-click the selected file "Homepage"
 * Example #2: When we right-click the selected file "Pricing page"
 * Example #3: And I right-click the selected file "Homepage"
 * Example #4: When I right-click the selected file "Webship test file"
 * Example #5: When I right-click the selected file "Sketches"
 */
When(/^(?:I|we) right-click the selected file "([^"]*)"$/, { timeout: 60000 }, async function (name) {
  const page = this.page;
  const card = h.fileCard(page, name);
  await card.click({ button: 'right' });
  await page.getByRole('menu').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
});

/**
 * Search the files of the team that is open with the dashboard's search box ("Search…"): the results replace the
 * projects as the words are typed.
 *
 * Example #1: When I search the dashboard for "Homepage"
 * Example #2: When we search the dashboard for "Style"
 * Example #3: And I search the dashboard for "Webship test"
 * Example #4: When I search the dashboard for "Pricing"
 * Example #5: When I search the dashboard for "nothing like this"
 */
When(/^(?:I|we) search the dashboard for "([^"]*)"$/, { timeout: 60000 }, async function (text) {
  const page = this.page;
  await h.onDashboard(this);
  const box = page.getByRole('textbox', { name: 'Search…' });
  await box.fill(text);
  await page.waitForURL((url) => url.searchParams.get('search-term') === text, { timeout: h.budget(this) }).catch(() => {});
  await h.settle(page, h.budget(this));
  await page.waitForTimeout(300);
});

/**
 * Assert that the screen lists a file, or does not: the cards of a project's files, the drafts, the shared libraries,
 * the results of a search.
 *
 * Example #1: Then the page should list the file "Homepage"
 * Example #2: Then the page should not list the file "Style guide"
 * Example #3: And the page should list the file "Sketches"
 * Example #4: Then the page should list the file "Style guide"
 * Example #5: But the page should not list the file "Webship test file"
 */
Then(/^the page should( not)? list the file "([^"]*)"$/, async function (notCase, name) {
  const page = this.page;
  await h.eventually(page, () => h.fileTitles(page), (names) => names.some((n) => h.normal(n) === h.normal(name)) === !notCase, async (names) => ({
    message: `The screen ${notCase ? 'lists' : 'does not list'} the file "${name}". It lists ${h.listed(names)}; ${await h.pageSummary(page)}.`,
    hint: 'Each section lists its own files: Drafts the drafts, Libraries the shared libraries, a search the files that match it.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Assert that the trash of the team (the tab "Deleted" of its projects) lists a file, or does not.
 *
 * Example #1: Then the trash should list the file "Webship test file"
 * Example #2: Then the trash should not list the file "Homepage"
 * Example #3: And the trash should list the file "Webship test file"
 * Example #4: Then the trash should not list the file "Webship test file"
 * Example #5: Then the trash should list the file "Webship test second file"
 */
Then(/^the trash should( not)? list the file "([^"]*)"$/, { timeout: 60000 }, async function (notCase, name) {
  const page = this.page;
  await h.onDashboard(this);
  const tab = page.getByTestId('deleted-tab');
  if (await tab.count()) await tab.click();
  await page.getByTestId('deleted-page-section').or(page.locator('main h1')).first().waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  await h.settle(page, h.budget(this));
  await h.eventually(page, () => h.fileTitles(page), (names) => names.some((n) => h.normal(n) === h.normal(name)) === !notCase, async (names) => ({
    message: `The trash ${notCase ? 'lists' : 'does not list'} the file "${name}". It lists ${h.listed(names)}.`,
    hint: 'A deleted file stays in the trash for 7 days.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Assert the projects pinned in the side bar of the dashboard ("Pinned Projects").
 *
 * Example #1: Then the pinned projects should list "Website redesign"
 * Example #2: Then the pinned projects should not list "Brand"
 * Example #3: And the pinned projects should list "Webship test project"
 * Example #4: Then the pinned projects should not list "Webship test project"
 * Example #5: Then the pinned projects should list "Website redesign"
 */
Then(/^the pinned projects should( not)? list "([^"]*)"$/, async function (notCase, name) {
  const page = this.page;
  await h.onDashboard(this);
  const read = async () => (await page.getByTestId('pinned-projects').locator('li').allInnerTexts().catch(() => [])).map(h.clean);
  await h.eventually(page, read, (names) => names.some((n) => h.normal(n) === h.normal(name)) === !notCase, async (names) => ({
    message: `The pinned projects ${notCase ? 'list' : 'do not list'} "${name}". They list ${h.listed(names)}.`,
    hint: 'A project is pinned with "Pin/Unpin" in its options; the side bar lists the pinned projects of the team that is open.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Assert that the screen offers a button by its words, or does not ("+ New project", "+ New File", "Add custom font",
 * "Invite people"): what a viewer of a team does not get.
 *
 * Example #1: Then the page should offer the button "+ New project"
 * Example #2: Then the page should not offer the button "+ New project"
 * Example #3: And the page should offer the button "Add custom font"
 * Example #4: Then the page should not offer the button "Add custom font"
 * Example #5: Then the page should offer the button "Invite people"
 */
Then(/^the page should( not)? offer the button "([^"]*)"$/, async function (notCase, words) {
  const page = this.page;
  const read = () => page.locator('main').getByRole('button', { name: h.exactly(words) }).filter({ visible: true }).count();
  await h.eventually(page, read, (n) => (n > 0) === !notCase, async () => ({
    message: `The page ${notCase ? 'offers' : 'does not offer'} the button "${words}": ${await h.pageSummary(page)}.`,
    hint: 'What a screen offers follows the role of the account in the team: a viewer gets no "+ New project", no "+ New File", no "Add custom font".',
  }), notCase ? 3000 : h.budget(this));
});
