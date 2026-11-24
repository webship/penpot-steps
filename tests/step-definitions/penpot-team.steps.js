'use strict';

// Teams: making and deleting one, the team switch, the team's options, its
// members and their roles, and its invitations (sent, warned about, selected,
// deleted).

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/** Open the team switch of the dashboard's side bar (the button with the team's name) and return its items. */
async function openTeamSwitch(world) {
  const page = world.page;
  await h.onDashboard(world);
  await page.getByTestId('dashboard-sidebar').locator('button[aria-haspopup="menu"]').first().click();
  await page.getByRole('menu').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: h.budget(world) }).catch(() => {});
  return h.openMenuItems(page);
}

/** Open a section of the team's management ("Members", "Invitations", "Settings") of the team that is open. */
async function teamSection(world, section) {
  const page = world.page;
  await h.onDashboard(world);
  const screen = { members: 'dashboard-members', invitations: 'dashboard-invitations', settings: 'dashboard-settings' }[h.normal(section)];
  if (screen === h.screenOf(page)) return;
  await page.getByTestId('team-options-button').click();
  await h.chooseInMenu(world, section);
  await page.waitForURL((url) => url.searchParams.get('screen') === screen, { timeout: h.budget(world) }).catch(() => {});
  await h.settle(page, h.budget(world));
}

/** The rows of the members' table: [{ text, address, role, changeable }]. */
async function memberRows(page) {
  return page.locator('[class*="table-row"]').filter({ hasNot: page.locator('[class*="table-row"]') }).evaluateAll((rows) => rows.map((r) => {
    const text = (r.innerText || '').replace(/\s+/g, ' ').trim();
    const box = r.querySelector('[role="combobox"]');
    const role = box ? (box.innerText || '').trim() : ((r.innerText || '').split('\n').map((t) => t.trim()).filter(Boolean).pop() || '');
    return { text, role, changeable: !!box };
  })).catch(() => []);
}

/** The row of a member by an address (or a handle of the registry). */
async function memberRow(world, who) {
  const page = world.page;
  await teamSection(world, 'Members');
  const address = h.addressOf(world, who);
  const row = page.locator('[class*="table-row"]').filter({ hasNot: page.locator('[class*="table-row"]') }).filter({ hasText: address }).first();
  await row.waitFor({ state: 'visible', timeout: h.budget(world) }).catch(() => {});
  if (!(await row.count())) {
    throw friendly({ message: `The team has no member "${address}". Its members: ${h.listed((await memberRows(page)).map((r) => r.text))}.`, hint: 'The build adds owner, admin, editor and viewer to "Design team".' });
  }
  return row;
}

/** The rows of the invitations' table: [{ address, text }]. */
async function invitationRows(page) {
  return page.locator('[class*="table-row-invitations"]').evaluateAll((rows) => rows.map((r) => ({
    address: (r.querySelector('input[type="checkbox"]') || {}).value || '',
    text: (r.innerText || '').replace(/\s+/g, ' ').trim(),
  }))).catch(() => []);
}

/**
 * Make a team from the team switch: "Create new team", its name, "Create new team". The dashboard of the new team
 * opens, and the steps after work in it.
 *
 * Example #1: When I create the team "Webship test team"
 * Example #2: When we create the team "Webship test team"
 * Example #3: And I create the team "Webship test agency"
 * Example #4: When I create the team "Webship test team"
 * Example #5: When I create the team "Webship test studio"
 */
When(/^(?:I|we) create the team "([^"]*)"$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  await openTeamSwitch(this);
  await h.chooseInMenu(this, 'Create new team');
  const field = h.dialog(page).getByRole('textbox', { name: 'Enter new team name' });
  await field.waitFor({ state: 'visible', timeout: h.budget(this) });
  await field.fill(name);
  await h.pressInDialog(this, 'Create new team');
  await h.eventually(page, () => page.title(), (t) => h.mentions(t, name), async (t) => ({ message: `The dashboard of the team "${name}" did not open; the page's title is "${t}".`, hint: 'The site opens the dashboard of a new team.' }), h.budget(this) * 2);
  this.__team = name;
  await h.hideTemplates(page);
});

/**
 * Assert the teams the team switch of the side bar lists, or that it does not list one (a deleted team leaves it).
 *
 * Example #1: Then the team switch should list "Design team"
 * Example #2: Then the team switch should not list "Webship test team"
 * Example #3: And the team switch should list "Personal Projects"
 * Example #4: Then the team switch should list "Webship test team"
 * Example #5: But the team switch should not list "Webship test agency"
 */
Then(/^the team switch should( not)? list "([^"]*)"$/, { timeout: 60000 }, async function (notCase, name) {
  const page = this.page;
  const items = await openTeamSwitch(this);
  await page.keyboard.press('Escape');
  const has = items.some((i) => h.normal(i) === h.normal(name));
  if (has === !!notCase) {
    throw friendly({ message: `The team switch ${notCase ? 'lists' : 'does not list'} "${name}". It lists ${h.listed(items)}.`, hint: 'The switch lists the teams of the account, then "Create new team".' });
  }
});

/**
 * Choose an item of the options of the team that is open (the button beside its name): "Members", "Invitations",
 * "Settings", "Rename", "Leave team", "Delete team".
 *
 * Example #1: When I choose "Delete team" in the team options
 * Example #2: When I choose "Members" in the team options
 * Example #3: And I choose "Invitations" in the team options
 * Example #4: When we choose "Settings" in the team options
 * Example #5: When I choose "Leave team" in the team options
 */
When(/^(?:I|we) choose "([^"]*)" in the team options$/, { timeout: 60000 }, async function (item) {
  const page = this.page;
  await h.onDashboard(this);
  await page.getByTestId('team-options-button').click();
  await h.chooseInMenu(this, item);
});

/**
 * Assert what the options of the team that is open offer, or that one is not offered (a viewer cannot invite, rename
 * or delete the team).
 *
 * Example #1: Then the team options should offer "Delete team"
 * Example #2: Then the team options should not offer "Invitations"
 * Example #3: And the team options should offer "Leave team"
 * Example #4: Then the team options should not offer "Delete team"
 * Example #5: Then the team options should offer "Members"
 */
Then(/^the team options should( not)? offer "([^"]*)"$/, { timeout: 60000 }, async function (notCase, item) {
  const page = this.page;
  await h.onDashboard(this);
  await page.getByTestId('team-options-button').click();
  const items = await h.eventually(page, () => h.openMenuItems(page), (list) => list.length > 0, async () => ({ message: 'The team options did not open.', hint: 'The button beside the team\'s name opens them.' }), h.budget(this));
  await page.keyboard.press('Escape');
  const has = items.some((i) => h.normal(i) === h.normal(item));
  if (has === !!notCase) {
    throw friendly({ message: `The team options ${notCase ? 'offer' : 'do not offer'} "${item}". They offer ${h.listed(items)}.`, hint: 'What the options offer follows the role of the account in the team.' });
  }
});

/**
 * Assert the role of a member of the team that is open (a handle of the registry or an address), on its Members
 * section: "Owner", "Admin", "Editor" or "Viewer".
 *
 * Example #1: Then the member "editor" should have the role "Editor"
 * Example #2: Then the member "owner" should have the role "Owner"
 * Example #3: And the member "viewer" should have the role "Viewer"
 * Example #4: Then the member "admin" should have the role "Admin"
 * Example #5: Then the member "viewer@example.com" should have the role "Editor"
 */
Then(/^the member "([^"]*)" should have the role "([^"]*)"$/, { timeout: 60000 }, async function (who, role) {
  const page = this.page;
  const row = await memberRow(this, who);
  const read = async () => {
    const box = row.getByRole('combobox');
    if (await box.count()) return h.clean(await box.first().innerText());
    const lines = (await row.innerText()).split('\n').map(h.clean).filter(Boolean);
    return lines[lines.length - 1] || '';
  };
  await h.eventually(page, read, (v) => h.normal(v) === h.normal(role), async (v) => ({
    message: `The member "${who}" has the role "${v}", not "${role}".`,
    hint: 'The Members section shows each member\'s role; the owner\'s cannot be changed.',
  }), h.budget(this));
});

/**
 * Assert that the role of a member can be changed on the Members section (it has a list of roles), or cannot (the
 * owner's, or every role for a member who is not an admin).
 *
 * Example #1: Then the role of the member "owner" should not be changeable
 * Example #2: Then the role of the member "editor" should be changeable
 * Example #3: And the role of the member "viewer" should be changeable
 * Example #4: Then the role of the member "editor" should not be changeable
 * Example #5: Then the role of the member "admin" should be changeable
 */
Then(/^the role of the member "([^"]*)" should( not)? be changeable$/, { timeout: 60000 }, async function (who, notCase) {
  const row = await memberRow(this, who);
  const changeable = (await row.getByRole('combobox').count()) > 0;
  if (changeable === !!notCase) {
    throw friendly({ message: `The role of the member "${who}" ${changeable ? 'can' : 'cannot'} be changed.`, hint: 'The owner\'s role never changes; only the owner and the admins change roles.' });
  }
});

/**
 * Change the role of a member on the Members section: its list of roles, then the new role. The role goes back after
 * the scenario, whatever its outcome.
 *
 * Example #1: When I change the role of the member "viewer" to "Editor"
 * Example #2: When we change the role of the member "editor" to "Viewer"
 * Example #3: And I change the role of the member "viewer" to "Viewer"
 * Example #4: When I change the role of the member "admin" to "Editor"
 * Example #5: When I change the role of the member "viewer" to "Admin"
 */
When(/^(?:I|we) change the role of the member "([^"]*)" to "([^"]*)"$/, { timeout: 90000 }, async function (who, role) {
  const page = this.page;
  const row = await memberRow(this, who);
  const box = row.getByRole('combobox').first();
  if (!(await box.count())) throw friendly({ message: `The role of the member "${who}" cannot be changed.`, hint: 'The owner\'s role never changes; only the owner and the admins change roles.' });
  const before = h.clean(await box.innerText());
  await box.click();
  const option = row.getByRole('listbox').getByRole('listitem').filter({ hasText: h.exactly(role) }).first();
  if (!(await option.count())) {
    throw friendly({ message: `The list of roles has no "${role}". It has ${h.listed(await row.getByRole('listbox').getByRole('listitem').allInnerTexts())}.`, hint: 'The roles are Viewer, Editor, Admin (and Owner, which hands the team over).' });
  }
  await option.click();
  await h.eventually(page, async () => h.clean(await box.innerText()), (v) => h.normal(v) === h.normal(role), async (v) => ({ message: `The role of "${who}" stayed "${v}".`, hint: 'The site changes the role as soon as it is picked.' }), h.budget(this));
  const team = h.currentTeamName(this);
  const address = h.addressOf(this, who);
  if (h.normal(before) !== h.normal(role)) {
    this.__restore.push(() => h.withApi(this, h.managerHandle(this), async (call) => {
      const t = await h.findTeam(call, team);
      const member = t && (await call('get-team-members', { teamId: t.id })).find((m) => h.normal(m.email) === h.normal(address));
      if (member) await call('update-team-member-role', { teamId: t.id, memberId: member.id, role: h.normal(before) });
    }));
  }
});

/**
 * Invite an address to the team that is open, from its Invitations section: "Invite people", the role, the address
 * (Enter makes it a chip), "Send invitation". A scenario invites only "webship-test-…" addresses.
 *
 * Example #1: When I invite "webship-test-invite@example.com" to the team as "Viewer"
 * Example #2: When we invite "webship-test-invite@example.com" to the team as "Editor"
 * Example #3: And I invite "webship-test-join@example.com" to the team as "Admin"
 * Example #4: When I invite "webship-test-invite@example.com" to the team as "Editor"
 * Example #5: When I invite "webship-test-other@example.com" to the team as "Viewer"
 */
When(/^(?:I|we) invite "([^"]*)" to the team as "([^"]*)"$/, { timeout: 90000 }, async function (address, role) {
  const page = this.page;
  await startInvitation(this, address);
  const dlg = h.dialog(page);
  const roleBox = dlg.getByRole('combobox').first();
  if (h.normal(await roleBox.innerText()) !== h.normal(role)) {
    await roleBox.click();
    const option = page.getByRole('option', { name: h.exactly(role) });
    if (!(await option.count())) throw friendly({ message: `The invitation offers no role "${role}". It offers ${h.listed(await page.getByRole('option').allInnerTexts())}.`, hint: 'The roles are Viewer, Editor and Admin.' });
    await option.click();
  }
  await h.pressInDialog(this, 'Send invitation');
});

/** Open the invitation's dialog of the team that is open and type an address in it (Enter makes it a chip). */
async function startInvitation(world, address) {
  const page = world.page;
  await teamSection(world, 'Invitations');
  const invite = page.locator('main').getByRole('button', { name: 'Invite people' }).first();
  if (!(await invite.count())) throw friendly({ message: `The Invitations section offers no "Invite people": ${await h.pageSummary(page)}.`, hint: 'Only the owner and the admins of a team invite.' });
  await invite.click();
  const box = h.dialog(page).getByRole('textbox', { name: 'Emails, comma separated' });
  await box.waitFor({ state: 'visible', timeout: h.budget(world) });
  await box.fill(h.addressOf(world, address));
  await box.press('Enter');
  await page.waitForTimeout(300);
}

/**
 * Open the invitation's dialog and type an address in it, without sending: to see what the dialog says of it (an
 * address of a member is not invited again).
 *
 * Example #1: When I start an invitation to "editor"
 * Example #2: When we start an invitation to "viewer@example.com"
 * Example #3: And I start an invitation to "webship-test-invite@example.com"
 * Example #4: When I start an invitation to "admin"
 * Example #5: When I start an invitation to "editor@example.com"
 */
When(/^(?:I|we) start an invitation to "([^"]*)"$/, { timeout: 90000 }, async function (address) {
  await startInvitation(this, address);
});

/**
 * Add an address to the invitation's dialog that is open (Enter makes it a chip).
 *
 * Example #1: When I add "webship-test-invite@example.com" to the invitation
 * Example #2: When we add "webship-test-join@example.com" to the invitation
 * Example #3: And I add "editor" to the invitation
 * Example #4: When I add "webship-test-other@example.com" to the invitation
 * Example #5: When I add "webship-test-invite@example.com" to the invitation
 */
When(/^(?:I|we) add "([^"]*)" to the invitation$/, { timeout: 60000 }, async function (address) {
  const page = this.page;
  const box = h.dialog(page).getByRole('textbox', { name: 'Emails, comma separated' });
  if (!(await box.count())) throw friendly({ message: 'No invitation is being written.', hint: 'Start one first: When I start an invitation to "…".' });
  await box.fill(h.addressOf(this, address));
  await box.press('Enter');
  await page.waitForTimeout(300);
});

/**
 * Assert that the Invitations section of the team that is open lists an address, with its status when one is named
 * ("Pending"), or does not list it.
 *
 * Example #1: Then the invitations should list "webship-test-invite@example.com" as "Pending"
 * Example #2: Then the invitations should not list "webship-test-invite@example.com"
 * Example #3: And the invitations should list "webship-test-invite@example.com"
 * Example #4: Then the invitations should list "webship-test-join@example.com" as "Pending"
 * Example #5: But the invitations should not list "webship-test-join@example.com"
 */
Then(/^the invitations should( not)? list "([^"]*)"(?: as "([^"]*)")?$/, { timeout: 60000 }, async function (notCase, address, status) {
  const page = this.page;
  await teamSection(this, 'Invitations');
  await h.eventually(page, () => invitationRows(page), (rows) => {
    const row = rows.find((r) => h.normal(r.address) === h.normal(address));
    if (notCase) return !row;
    return !!row && (!status || h.mentions(row.text, status));
  }, async (rows) => ({
    message: `The invitations ${notCase ? 'list' : 'do not list'} "${address}"${status && !notCase ? ` as "${status}"` : ''}. They list ${h.listed(rows.map((r) => r.text))}.`,
    hint: 'An invitation stays "Pending" until the address accepts it; an address that has an account joins at once and is not listed.',
  }), notCase ? 3000 : h.budget(this));
});

/**
 * Tick the invitation of an address on the Invitations section: the actions for the ticked ones come ("Resend
 * invitation", "Delete invitation") with their count ("1 invitation selected").
 *
 * Example #1: When I select the invitation to "webship-test-invite@example.com"
 * Example #2: When we select the invitation to "webship-test-join@example.com"
 * Example #3: And I select the invitation to "webship-test-invite@example.com"
 * Example #4: When I select the invitation to "webship-test-other@example.com"
 * Example #5: When I select the invitation to "webship-test-invite@example.com"
 */
When(/^(?:I|we) select the invitation to "([^"]*)"$/, { timeout: 60000 }, async function (address) {
  const page = this.page;
  await teamSection(this, 'Invitations');
  const label = page.locator('[class*="table-row-invitations"] label').filter({ hasText: h.exactly(address) }).first();
  if (!(await label.count())) throw friendly({ message: `The invitations do not list "${address}". They list ${h.listed((await invitationRows(page)).map((r) => r.text))}.`, hint: 'Invite the address first.' });
  await label.click();
  await page.getByRole('button', { name: 'Delete invitation' }).waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
});

/**
 * Delete the invitation of an address: its row ticked, "Delete invitation", "Continue" in the dialog that asks.
 *
 * Example #1: When I delete the invitation to "webship-test-invite@example.com"
 * Example #2: When we delete the invitation to "webship-test-join@example.com"
 * Example #3: And I delete the invitation to "webship-test-invite@example.com"
 * Example #4: When I delete the invitation to "webship-test-other@example.com"
 * Example #5: When I delete the invitation to "webship-test-invite@example.com"
 */
When(/^(?:I|we) delete the invitation to "([^"]*)"$/, { timeout: 90000 }, async function (address) {
  const page = this.page;
  const box = page.getByRole('checkbox', { name: address });
  if (!(await box.count()) || !(await box.isChecked().catch(() => false))) {
    await page.locator('[class*="table-row-invitations"] label').filter({ hasText: h.exactly(address) }).first().click().catch(() => {});
  }
  const remove = page.getByRole('button', { name: 'Delete invitation' });
  if (!(await remove.count())) throw friendly({ message: `The invitation to "${address}" cannot be deleted: ${await h.pageSummary(page)}.`, hint: 'Select it first on the Invitations section.' });
  await remove.click();
  await h.pressInDialog(this, 'Continue');
});
