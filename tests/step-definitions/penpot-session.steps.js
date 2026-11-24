'use strict';

// The session: logging in and out, who is logged in, the login page and its
// refusals, the password recovery through its mail, the registration form
// (only its refusals: a suite never makes an account), and the onboarding
// questionnaire a new account answers.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/**
 * Log in as an account of the users registry, by its handle: the session the account opened earlier in the run when
 * there is one, else the login form.
 *
 * Example #1: Given I am a logged in user with the "owner" user
 * Example #2: Given we are a logged in user with the "editor" user
 * Example #3: And I am a logged in user with the "viewer" user
 * Example #4: Given I am a logged in user with the "admin" user
 * Example #5: Given I am a logged in user with "editor"
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await h.logInAs(this, handle);
});

/**
 * Log in through the login form as an account of the users registry: its address and its password typed in, as a
 * person does. The session is kept for the scenarios after.
 *
 * Example #1: When I log in as "editor" with the login form
 * Example #2: When we log in as "owner" with the login form
 * Example #3: And I log in as "viewer" with the login form
 * Example #4: When I log in as "admin" with the login form
 * Example #5: Given I log in as "editor" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = h.resolveUser(this, handle);
  h.forgetSession(this, user.email);
  await h.logInPage(this, this.page, user);
  this.__account = user.email;
  this.__accountHandle = handle;
});

/**
 * Fill in the login form with an address and a password as they are, and send it when it can be sent: to see a login
 * refused (a malformed address keeps the button disabled). A suite logs in by a handle; a password here is only ever
 * a wrong one.
 *
 * Example #1: When I log in with the email "editor@example.com" and the password "Wrong-password-1"
 * Example #2: When we log in with the email "nobody@example.com" and the password "Wrong-password-2"
 * Example #3: And I log in with the email "not-an-address" and the password "Wrong-password-3"
 * Example #4: When I log in with the email address "owner@example.com" and the password "Wrong-password-4"
 * Example #5: When I log in with the email "editor@example.com" and the password "x"
 */
When(/^(I |we )*log in with the (?:email address|email) "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, email, password) {
  await h.submitLogin(this, this.page, email, password);
  this.__account = null;
});

/**
 * Assert that the login form refused the login, with a message (or a part of it): the message the login page writes
 * above its fields, or the error under a field. Nobody is logged in and the page is still the login page.
 *
 * Example #1: Then the login should be refused with "Email or password is incorrect."
 * Example #2: Then the login should be refused with "Enter a valid email please"
 * Example #3: And the login should be refused with "is incorrect"
 * Example #4: Then the login should be refused with "Email or password"
 * Example #5: Then the login should be refused with "valid email"
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const said = await h.eventually(page, () => h.formErrors(page), (errors) => errors.some((t) => h.mentions(t, expected)), async () => ({ message: '', hint: '' }), h.budget(this)).catch(() => null);
  const who = await h.signedInEmail(this, page);
  if (who || h.screenOf(page) !== 'auth-login' || !said) {
    throw friendly({
      message: who
        ? `The login was not refused: ${who} is logged in; ${await h.pageSummary(page)}.`
        : `The login page did not refuse the login with "${expected}". It says ${h.listed(await h.formErrors(page))}; ${await h.pageSummary(page)}.`,
      hint: h.hintFor(page, 'Fill in the form first (When I log in with the email "…" and the password "…"); the page writes its refusal above the fields, and an error under a field it cannot take.'),
    });
  }
});

/**
 * Start as a visitor: no session (the cookies of the browser cleared), on the login page.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: When I am not logged in
 * Example #5: Given I am not logged in
 */
Given(/^(I am |we are )*not logged in$/, { timeout: 60000 }, async function (pronounCase) {
  await this.page.context().clearCookies();
  this.__account = null;
  await h.open(this, h.screenUrl(this, 'auth-login'));
});

/**
 * Log out through the menu of the account (the button with its name at the bottom of the dashboard's side bar):
 * "Logout". The session of the account is forgotten.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, { timeout: 90000 }, async function (pronounCase) {
  const page = this.page;
  const button = await h.profileButton(this, page);
  if (!(await button.count())) {
    throw friendly({ message: `Nobody is logged in: ${await h.pageSummary(page)}.`, hint: 'Log in first: Given I am a logged in user with the "editor" user.' });
  }
  const email = await h.signedInEmail(this, page);
  await button.click();
  await h.chooseInMenu(this, 'Logout');
  await page.waitForURL((url) => /screen=auth-login/.test(url.search), { timeout: h.budget(this) * 2 }).catch(() => {});
  if (email) h.forgetSession(this, email);
  this.__account = null;
});

/**
 * Assert who is logged in: the profile of the browser's session, against an account of the users registry (its
 * handle) or an address.
 *
 * Example #1: Then I should be logged in as "editor"
 * Example #2: Then we should be logged in as "owner"
 * Example #3: And I should be logged in as "viewer@example.com"
 * Example #4: Then I should be logged in as "admin"
 * Example #5: Then I should be logged in as "editor@example.com"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, who) {
  const expected = h.addressOf(this, who).toLowerCase();
  const email = (await h.signedInEmail(this, this.page)).toLowerCase();
  if (email !== expected) {
    throw friendly({
      message: email ? `"${email}" is logged in, not "${expected}".` : `Nobody is logged in: ${await h.pageSummary(this.page)}.`,
      hint: 'The session is the browser\'s: a login of another account in the same scenario replaces it.',
    });
  }
});

/**
 * Assert that somebody is logged in, or nobody: the profile of the browser's session.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: And we should be logged in
 * Example #4: Then we should not be logged in
 * Example #5: But I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  const email = await h.signedInEmail(this, this.page);
  if (notCase && email) throw friendly({ message: `"${email}" is logged in.`, hint: 'Log out first (When I log out), or start as a visitor (Given I am not logged in).' });
  if (!notCase && !email) throw friendly({ message: `Nobody is logged in: ${await h.pageSummary(this.page)}.`, hint: 'Log in first: Given I am a logged in user with the "editor" user.' });
});

/**
 * Assert that the page is the login page (its heading "Log into my account"), with a message on it when one is named.
 * An old address of the login page (with a "#/" part) lands there too, the "#" part gone.
 *
 * Example #1: Then I should be on the login page
 * Example #2: Then we should be on the login page
 * Example #3: And I should be on the login page
 * Example #4: Then I should be on the login page saying "Email or password is incorrect."
 * Example #5: Then we should be on the login page saying "incorrect"
 */
Then(/^(I |we )*should be on the login page(?: saying "([^"]*)")?$/, async function (pronounCase, said) {
  const page = this.page;
  await h.eventually(page, async () => ({ screen: h.screenOf(page), heading: await h.heading(page) }), (v) => v.screen === 'auth-login' && /log into my account/i.test(v.heading), async () => ({
    message: `The page is not the login page: ${await h.pageSummary(page)}.`,
    hint: 'The login page is /?screen=auth-login, with the heading "Log into my account"; a visitor is sent there from the app.',
  }), h.budget(this));
  if (said) {
    await h.eventually(page, () => h.formErrors(page), (m) => m.some((x) => h.mentions(x, said)), async (m) => ({
      message: `The login page does not say "${said}". It says ${h.listed(m)}.`,
      hint: 'The login page writes its messages above its fields.',
    }), h.budget(this));
  }
});

/**
 * Assert that the page is the registration form (its heading "Create an account"): the link "Create an account" of
 * the login page and the link of an invitation mail lead there.
 *
 * Example #1: Then I should be on the registration page
 * Example #2: Then we should be on the registration page
 * Example #3: And I should be on the registration page
 * Example #4: Then I should be on the registration page
 * Example #5: But I should be on the registration page
 */
Then(/^(I |we )*should be on the registration page$/, async function (pronounCase) {
  const page = this.page;
  await h.eventually(page, async () => ({ screen: h.screenOf(page), heading: await h.heading(page) }), (v) => v.screen === 'auth-register' && /create an account/i.test(v.heading), async () => ({
    message: `The page is not the registration form: ${await h.pageSummary(page)}.`,
    hint: 'The registration form is /?screen=auth-register ("Create an account"); the site must allow registration.',
  }), h.budget(this));
});

/**
 * Ask for a password recovery link on the page "Forgot password?" for an account of the registry (by its handle) or an
 * address: the address typed in and "Recover password" pressed. The site says it sent the link.
 *
 * Example #1: When I ask for a password reset link for "editor"
 * Example #2: When we ask for a password reset link for "viewer"
 * Example #3: And I ask for a password reset link for "nobody@example.com"
 * Example #4: When I ask for a password reset link for "admin"
 * Example #5: When I ask for a password reset link for "editor@example.com"
 */
When(/^(I |we )*ask for a password reset link for "([^"]*)"$/, { timeout: 90000 }, async function (pronounCase, who) {
  const page = this.page;
  await page.context().clearCookies();
  this.__account = null;
  await h.open(this, h.screenUrl(this, 'auth-recovery-request'));
  const field = page.getByRole('textbox', { name: 'Work email' });
  await field.waitFor({ state: 'visible', timeout: h.budget(this) * 2 }).catch(() => {});
  if (!(await field.count())) {
    throw friendly({ message: `The page "Forgot password?" has no field "Work email": ${await h.pageSummary(page)}.`, hint: 'The page is /?screen=auth-recovery-request, linked from the login page as "Forgot password?".' });
  }
  await field.fill(h.addressOf(this, who));
  await page.getByRole('button', { name: 'Recover password' }).click();
  await h.settle(page, h.budget(this));
});

/**
 * On the page the recovery mail links to, set the account's password to the one the users registry gives it (so the
 * suite can run again), twice, and send it: the site takes the browser to the login page.
 *
 * Example #1: When I set the password of "editor" on the reset page
 * Example #2: When we set the password of "viewer" on the reset page
 * Example #3: And I set the password of "editor" on the reset page
 * Example #4: When I set the password of "admin" on the reset page
 * Example #5: Then we set the password of "editor" on the reset page
 */
When(/^(?:I|we) set the password of "([^"]*)" on the reset page$/, { timeout: 90000 }, async function (who) {
  const page = this.page;
  const user = h.resolveUser(this, who);
  const fields = page.locator('input[type="password"]').filter({ visible: true });
  await fields.first().waitFor({ state: 'visible', timeout: h.budget(this) * 2 }).catch(() => {});
  if ((await fields.count()) < 2 || h.screenOf(page) !== 'auth-recovery') {
    throw friendly({ message: `The page is not the page of a recovery link: ${await h.pageSummary(page)}.`, hint: 'Open the link of the recovery mail first: When I open the link of the email with the subject "Password reset" to "editor".' });
  }
  await fields.nth(0).fill(user.password);
  await fields.nth(1).fill(user.password);
  await page.getByRole('button', { name: /change your password/i }).click();
  await page.waitForURL((url) => /screen=auth-login/.test(url.search), { timeout: h.budget(this) * 2 }).catch(() => {});
  await h.settle(page, h.budget(this));
  h.forgetSession(this, user.email);
});

/**
 * Fill in the registration form ("Create an account") and send it when it can be sent: to see it refused. The form of
 * the page when it is open already (the link of an invitation opens it), else a new one for a visitor. A suite never
 * completes a registration: accounts are made by the build of the site.
 *
 * Example #1: When I try to register with the name "Webship test", the email "owner@example.com" and the password "dD.123123ddd"
 * Example #2: When we try to register with the name "Webship test", the email "not-an-address" and the password "Webship-test-1"
 * Example #3: And I try to register with the name "Webship test", the email "webship-test@example.com" and the password "short"
 * Example #4: When I try to register with the name "Webship test", the email "webship-test-other@example.com" and the password "Webship-test-1"
 * Example #5: When I try to register with the name "Webship test", the email "editor@example.com" and the password "Webship-test-2"
 */
When(/^(?:I|we) try to register with the name "([^"]*)", the email "([^"]*)" and the password "([^"]*)"$/, { timeout: 90000 }, async function (name, email, password) {
  const page = this.page;
  if (h.screenOf(page) !== 'auth-register') {
    await page.context().clearCookies();
    this.__account = null;
    await h.open(this, h.screenUrl(this, 'auth-register'));
  }
  const nameField = page.getByRole('textbox', { name: 'Full name' });
  await nameField.waitFor({ state: 'visible', timeout: h.budget(this) * 2 }).catch(() => {});
  if (!(await nameField.count())) {
    throw friendly({ message: `The registration form did not appear: ${await h.pageSummary(page)}.`, hint: 'The form is /?screen=auth-register ("Create an account"); the site must allow registration.' });
  }
  await nameField.fill(name);
  await page.getByRole('textbox', { name: 'Work email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('textbox', { name: 'Password' }).blur();
  await page.waitForTimeout(200);
  const button = page.getByRole('button', { name: 'Create an account' });
  if (await button.isEnabled().catch(() => false)) {
    await button.click();
    await h.settle(page, h.budget(this));
  }
});

/**
 * Assert that the registration form refused what it was given, with a message (or a part of it): an error under a
 * field, while the page stays the registration form.
 *
 * Example #1: Then the registration should be refused with "Email already used"
 * Example #2: Then the registration should be refused with "Enter a valid email please"
 * Example #3: And the registration should be refused with "Email does not match the invitation."
 * Example #4: Then the registration should be refused with "Password should at least be 8 characters"
 * Example #5: Then the registration should be refused with "already used"
 */
Then(/^the registration should be refused with "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await h.eventually(page, () => h.formErrors(page), (said) => h.screenOf(page) === 'auth-register' && said.some((t) => h.mentions(t, expected)), async (said) => ({
    message: h.screenOf(page) !== 'auth-register'
      ? `The registration was not refused: ${await h.pageSummary(page)}.`
      : `The registration form does not say "${expected}". It says ${h.listed(said)}.`,
    hint: 'Fill in the form first (When I try to register with the name "…", the email "…" and the password "…"); the form writes an error under the field it refuses.',
  }), h.budget(this));
});

// ---------------------------------------------------------------------------
// The onboarding questionnaire
// ---------------------------------------------------------------------------

/** The visible part of the onboarding (the questionnaire, then the choice of a team), or null. */
async function onboarding(page) {
  const root = page.locator('[class*="main_ui_onboarding"]').filter({ visible: true }).first();
  return (await root.count()) ? root : null;
}

/** The headings the onboarding shows, in one list. */
async function onboardingHeadings(page) {
  return (await page.locator('[class*="main_ui_onboarding"] :is(h1, h2, h3)').filter({ visible: true }).allInnerTexts().catch(() => [])).map(h.clean);
}

/**
 * Make an account meet the onboarding again: the questionnaire when the account never answered it, else the choice of a
 * team. Set through the site's API as the account itself; put back after the scenario, whatever its outcome. (Answers
 * sent with "Start" stay on the account for good: a suite walks the questionnaire without sending them.)
 *
 * Example #1: Given "viewer" has not done the onboarding yet
 * Example #2: Given "editor" has not done the onboarding yet
 * Example #3: And "viewer" has not done the onboarding yet
 * Example #4: Given "admin" has not done the onboarding yet
 * Example #5: Given "viewer" has not done the onboarding yet
 */
Given(/^"([^"]*)" has not done the onboarding yet$/, { timeout: 90000 }, async function (handle) {
  const props = (seen) => ({ props: { 'onboarding-viewed': seen } });
  await h.withApi(this, handle, (call) => call('update-profile-props', props(false)));
  this.__restore.push(() => h.withApi(this, handle, (call) => call('update-profile-props', props(true))));
  h.forgetSession(this, h.resolveUser(this, handle).email);
});

/**
 * Assert what the onboarding asks: one of its headings ("Help us get to know you", "Which one of these tools do you use
 * the most?", "Welcome to Penpot!"), or a part of it.
 *
 * Example #1: Then the onboarding should ask "Help us get to know you"
 * Example #2: Then the onboarding should ask "Which one of these tools do you use the most?"
 * Example #3: And the onboarding should ask "Where would you like to get started?"
 * Example #4: Then the onboarding should ask "What kind of work do you do?"
 * Example #5: Then the onboarding should ask "What's a team?"
 */
Then(/^the onboarding should ask "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await h.eventually(page, () => onboardingHeadings(page), (heads) => heads.some((t) => h.mentions(t, expected)), async (heads) => ({
    message: heads.length ? `The onboarding does not ask "${expected}". It shows ${h.listed(heads)}.` : `No onboarding is on show: ${await h.pageSummary(page)}.`,
    hint: 'The onboarding comes after the login of an account that has not done it (Given "viewer" has not done the onboarding yet).',
  }), h.budget(this) * 2);
});

/**
 * Choose an answer of the onboarding's questionnaire: a choice by its words, or an entry of its list ("What kind of
 * work do you do?"), which the step opens first.
 *
 * Example #1: When I choose "Personal" in the onboarding
 * Example #2: When I choose "Product Management" in the onboarding
 * Example #3: And I choose "Other" in the onboarding
 * Example #4: When we choose "Prototyping" in the onboarding
 * Example #5: When I choose "Work" in the onboarding
 */
When(/^(?:I|we) choose "([^"]*)" in the onboarding$/, { timeout: 60000 }, async function (answer) {
  const page = this.page;
  const root = await onboarding(page);
  if (!root) throw friendly({ message: `No onboarding is on show: ${await h.pageSummary(page)}.`, hint: 'The onboarding comes after the login of an account that has not done it.' });
  const radio = root.getByRole('radio', { name: h.exactly(answer) });
  if (await radio.count()) {
    await root.getByText(answer, { exact: true }).first().click();
    return;
  }
  const option = page.getByRole('option', { name: h.exactly(answer) }).or(page.locator('[class*="main_ui_onboarding"] li').filter({ hasText: h.exactly(answer) })).filter({ visible: true }).first();
  if (!(await option.count())) {
    const box = root.getByRole('combobox').first();
    if (await box.count()) {
      await box.click();
      await page.waitForTimeout(200);
    }
  }
  const choice = page.getByText(answer, { exact: true }).filter({ visible: true }).last();
  if (!(await choice.count())) {
    const offered = await root.getByRole('radio').evaluateAll((es) => es.map((e) => e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].innerText) || e.value)).catch(() => []);
    throw friendly({ message: `The onboarding offers no "${answer}". It offers ${h.listed(offered)}.`, hint: 'Name a choice as it is written on the step on show.' });
  }
  await choice.click();
});

/**
 * Type an answer in a box of the onboarding by its name ("Other (specify)", "Team name").
 *
 * Example #1: When I answer "Webship test" in the box "Other (specify)" of the onboarding
 * Example #2: When we answer "Webship test team" in the box "Team name" of the onboarding
 * Example #3: And I answer "Webship test" in the box "Other (specify)" of the onboarding
 * Example #4: When I answer "Testing" in the box "Other (specify)" of the onboarding
 * Example #5: When I answer "Webship test" in the box "Other (specify)" of the onboarding
 */
When(/^(?:I|we) answer "([^"]*)" in the box "([^"]*)" of the onboarding$/, { timeout: 60000 }, async function (text, box) {
  const page = this.page;
  const root = await onboarding(page);
  const field = root ? root.getByRole('textbox', { name: h.exactly(box) }).first() : null;
  if (!field || !(await field.count())) {
    const offered = root ? await root.getByRole('textbox').evaluateAll((es) => es.map((e) => e.getAttribute('aria-label') || e.placeholder)) : [];
    throw friendly({ message: `The onboarding has no box "${box}". It has ${h.listed(offered)}.`, hint: '"Other (specify)" comes once "Other" is chosen.' });
  }
  await field.fill(text);
});

/**
 * Press a button or a link of the onboarding by its words: "Next", "Previous", "Start", "Continue without team".
 *
 * Example #1: When I press "Next" in the onboarding
 * Example #2: When I press "Start" in the onboarding
 * Example #3: And I press "Continue without team" in the onboarding
 * Example #4: When we press "Previous" in the onboarding
 * Example #5: When I press "Next" in the onboarding
 */
When(/^(?:I|we) press "([^"]*)" in the onboarding$/, { timeout: 60000 }, async function (words) {
  const page = this.page;
  const root = await onboarding(page);
  const control = page.locator('[class*="main_ui_onboarding"] :is(button, a, input[type="submit"])').filter({ visible: true }).filter({ hasText: h.exactly(words) }).last();
  if (!root || !(await control.count())) {
    const offered = await page.locator('[class*="main_ui_onboarding"] :is(button, a)').filter({ visible: true }).allInnerTexts().catch(() => []);
    throw friendly({ message: `The onboarding has no "${words}". It offers ${h.listed(offered)}.`, hint: 'Each step of the questionnaire has "Next" (the last one "Start"); the choice of a team has "Continue without team".' });
  }
  if (!(await control.isEnabled().catch(() => true))) {
    throw friendly({ message: `"${words}" of the onboarding is disabled: an answer of the step is missing.`, hint: 'Choose an answer for each question of the step on show first.' });
  }
  await control.click();
  await h.settle(page, h.budget(this));
});

/**
 * Assert that a button of the onboarding is enabled or disabled (it waits for the answers of its step).
 *
 * Example #1: Then the button "Next" of the onboarding should be disabled
 * Example #2: Then the button "Next" of the onboarding should be enabled
 * Example #3: And the button "Start" of the onboarding should be disabled
 * Example #4: Then the button "Start" of the onboarding should be enabled
 * Example #5: But the button "Next" of the onboarding should be disabled
 */
Then(/^the button "([^"]*)" of the onboarding should be (enabled|disabled)$/, async function (words, state) {
  const page = this.page;
  const control = page.locator('[class*="main_ui_onboarding"] :is(button, input[type="submit"])').filter({ visible: true }).filter({ hasText: h.exactly(words) }).last();
  await h.eventually(page, async () => ((await control.count()) ? ((await control.isEnabled()) ? 'enabled' : 'disabled') : 'missing'), (v) => v === state, async (v) => ({
    message: v === 'missing' ? `The onboarding has no button "${words}".` : `The button "${words}" of the onboarding is ${v}, not ${state}.`,
    hint: 'The button of a step waits for an answer to each of its questions.',
  }), h.budget(this));
});

/**
 * Assert that the onboarding is over: none of its steps is on show and the dashboard is there.
 *
 * Example #1: Then the onboarding should be over
 * Example #2: And the onboarding should be over
 * Example #3: Then the onboarding should be over
 * Example #4: But the onboarding should be over
 * Example #5: Then the onboarding should be over
 */
Then(/^the onboarding should be over$/, async function () {
  const page = this.page;
  await h.eventually(page, async () => ({ open: !!(await onboarding(page)), dashboard: await page.getByTestId('dashboard-sidebar').count() }), (v) => !v.open && v.dashboard > 0, async (v) => ({
    message: v.open ? `The onboarding is still on show: ${h.listed(await onboardingHeadings(page))}.` : `The dashboard is not there: ${await h.pageSummary(page)}.`,
    hint: 'The last step of the questionnaire is "Start", then the choice of a team ("Continue without team").',
  }), h.budget(this) * 2);
});
