'use strict';

// Shared plumbing of the steps: addresses and screens, opening a page and
// waiting for the app, the answers of the site (its messages, the errors of
// its forms, its dialogs and menus), the users registry and the session
// cache, the site's own API (what a Given step prepares or removes, as an
// account of the registry, never in the scenario's browser), the dashboard,
// the workspace (its layers, its tools, its panels), downloads and the mail
// catcher.
//
// This file registers no step (but the hooks at its end).
//
// The app is a single page: a screen is a query string of the one page
// (`/?screen=dashboard-recent&team-id=…`), each screen draws itself once its
// data came over the API, and the canvas of the workspace is drawn by the
// browser. The steps wait for what a person waits for (a project's card, a
// layer's row, a value in a panel), never for a fixed time. Its messages
// ("Your file has been deleted successfully") come at the bottom and go after
// a few seconds: a script the pack adds to every page records each one as it
// comes, so a step reads it even when it is gone.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Before, After } = require('@cucumber/cucumber');
const { gotoUrl, friendly, onNewPage } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Budgets and text
// ---------------------------------------------------------------------------

/** The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 10 seconds. */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** White space collapsed and trimmed; the invisible marks some texts carry removed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/[­​-‏‪-‮⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
}

/** A text as a comparison sees it: cleaned, in lower case, the typographic quotes the same as the straight ones. */
function normal(text) {
  return clean(text).replace(/[“”„"]/g, '"').replace(/[‘’‚']/g, "'").replace(/["']/g, "'").toLowerCase();
}

/** Whether a text contains another, as `normal` reads them. */
function mentions(text, part) {
  return normal(text).includes(normal(part));
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A RegExp that matches a whole text, letter case and the white space around it aside. */
function exactly(text) {
  return new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, 'i');
}

// ---------------------------------------------------------------------------
// Addresses and screens
// ---------------------------------------------------------------------------

/** The site's root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** An address of the site from a path (absolute URLs stay as they are). */
function absolute(world, href) {
  if (/^https?:\/\//.test(href)) return href;
  return siteRoot(world) + (String(href).startsWith('/') ? '' : '/') + href;
}

/** The address of a screen of the app: `/?screen=<name>&<params>`. */
function screenUrl(world, screen, params = {}) {
  const query = new URLSearchParams({ screen, ...params });
  return absolute(world, `/?${query.toString()}`);
}

/** The screen a page shows (`dashboard-recent`, `workspace`, `auth-login`, …), from its address. */
function screenOf(page) {
  try {
    return new URL(page.url()).searchParams.get('screen') || '';
  } catch (err) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// The request the browser cut, opening a page, waiting
// ---------------------------------------------------------------------------

/** Whether the browser shows its own error page instead of the site's answer. Returns a sentence, or ''. */
function cutRequest(page) {
  const url = String((page && page.url()) || '');
  return url.startsWith('chrome-error://') ? `the browser shows its own error page (${url}): the request was cut before the site answered` : '';
}

/** The hint of a failure where the browser cut the request. */
const CUT_HINT = 'The request was cut because the network of the machine changed (a container starting); nothing is wrong with the scenario. Run it again. On a shared machine, run the suite in the project\'s container (cmd-tools-testing.sh <project> --run in the Webship Workspace).';

/** The hint for a failure: the cut request's when the browser cut it, else the one given. */
function hintFor(page, hint) {
  return cutRequest(page) ? CUT_HINT : hint;
}

/** Wait until the app drew its screen: the document loaded and no loader of the app is on show. */
async function settle(page, timeout) {
  const limit = timeout || 15000;
  await page.waitForLoadState('load', { timeout: limit }).catch(() => {});
  await page.waitForFunction(() => {
    if (document.readyState !== 'complete') return false;
    // The app mounts into #app after the page loaded: an empty #app is a screen not drawn yet.
    const app = document.getElementById('app');
    if (app && !app.firstElementChild) return false;
    const loader = [...document.querySelectorAll('[class*="loader"], [data-testid="loader"]')]
      .find((e) => e.offsetParent !== null && !e.closest('[class*="thumbnail"]') && !e.closest('[class*="grid-item"]'));
    return !loader;
  }, null, { timeout: limit, polling: 100 }).catch(() => {});
}

/**
 * Open a URL in a page and wait for the app to draw it. A network change on the
 * machine aborts a navigation once now and then: the step goes again for up to
 * 30 seconds, then reports it in webship-js's own words.
 */
async function openIn(page, url, timeout) {
  const go = () => page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeout || 60000 });
  let response = null;
  const CUT = /ERR_NETWORK_CHANGED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|chrome-error:\/\/chromewebdata|ERR_ABORTED|frame was detached/;
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      response = await go();
      break;
    } catch (err) {
      if (!CUT.test(String(err && err.message)) || Date.now() > deadline) {
        await gotoUrl(page, url);
        break;
      }
      await page.waitForTimeout(1000);
    }
  }
  if (cutRequest(page)) {
    await page.waitForTimeout(500);
    response = await go().catch(() => null);
  }
  await settle(page, timeout);
  return response;
}

/** Open a path or an address of the site in the scenario's page. */
async function open(world, path) {
  return openIn(world.page, absolute(world, path), budget(world) * 3);
}

/**
 * The button of the profile at the bottom of the dashboard's side bar, once the app drew the screen: the app routes
 * to a dashboard before it has drawn it, so the step waits for the button, or for the login form when nobody is
 * logged in.
 */
async function profileButton(world, page) {
  const button = page.getByTestId('profile-btn');
  if (!(await button.count())) await open(world, '/');
  await button.or(page.getByRole('textbox', { name: 'Work email' })).first()
    .waitFor({ state: 'visible', timeout: budget(world) * 3 }).catch(() => {});
  return button;
}

/** Retry a check until it holds or the budget runs out; on time out, throw what `failure` makes of the last value. */
async function eventually(page, read, ok, failure, timeout) {
  const limit = Date.now() + (timeout || 10000);
  let value;
  for (;;) {
    value = await read();
    if (ok(value)) return value;
    if (Date.now() > limit) break;
    await page.waitForTimeout(250);
  }
  const { message, hint } = await failure(value);
  throw friendly({ message, hint: hintFor(page, hint) });
}

/** The heading of a screen, for a failure message and for a check: its first visible h1 with words. */
async function heading(page) {
  const texts = await page.locator('h1').filter({ visible: true }).allInnerTexts().catch(() => []);
  return clean(texts.find((t) => clean(t)) || '');
}

/** What the page shows, in one line: its heading, its title and its screen. */
async function pageSummary(page) {
  const h = await heading(page);
  const title = clean(await page.title().catch(() => ''));
  return `the page shows "${h || '(no heading)'}" (title "${title}") on the screen ${screenOf(page) || '(none)'}`;
}

// ---------------------------------------------------------------------------
// Messages, form errors, dialogs, menus
// ---------------------------------------------------------------------------

/** The script each page gets: every message of the site is recorded as it comes, with its text. */
const TOAST_RECORDER = `(() => {
  if (window.__wsToastsInstalled) return;
  window.__wsToastsInstalled = true;
  window.__wsToasts = [];
  const seen = new WeakSet();
  const look = (root) => {
    if (!root || root.nodeType !== 1) return;
    const els = [root, ...root.querySelectorAll('[class*="toast__toast"], [class*="context_notification"]')];
    for (const e of els) {
      const cls = String(e.className || '');
      if (!/toast__toast|context_notification/.test(cls) || seen.has(e)) continue;
      const text = (e.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!text) continue;
      seen.add(e);
      window.__wsToasts.push({ text, level: /error/.test(cls) ? 'error' : /warning/.test(cls) ? 'warning' : 'info', at: Date.now() });
    }
  };
  const start = () => {
    new MutationObserver((ms) => { for (const m of ms) { for (const n of m.addedNodes) look(n); if (m.type === 'characterData' && m.target.parentElement) look(m.target.parentElement); } })
      .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})();`;

/** Give a page the recorder of messages (each page of a scenario gets it through the hook below). */
async function recordToasts(page) {
  await page.addInitScript(TOAST_RECORDER).catch(() => {});
  await page.evaluate(TOAST_RECORDER).catch(() => {});
}

/** The messages a page showed since it opened, and those it shows now: [{ text, level }]. */
async function messages(page) {
  return page.evaluate(() => {
    const out = (window.__wsToasts || []).map((t) => ({ text: t.text, level: t.level }));
    for (const e of document.querySelectorAll('[class*="toast__toast"], [class*="context_notification"]')) {
      const text = (e.innerText || '').replace(/\s+/g, ' ').trim();
      if (text && !out.some((o) => o.text === text)) out.push({ text, level: /error/.test(String(e.className)) ? 'error' : 'info' });
    }
    return out;
  }).catch(() => []);
}

/** The errors a form shows under its fields, and the messages of the page: visible texts. */
async function formErrors(page) {
  const errors = await page.locator('[class*="forms__error"], [data-testid$="-error"], [class*="context_notification"]').filter({ visible: true }).allInnerTexts().catch(() => []);
  const said = (await messages(page)).map((m) => m.text);
  return [...new Set([...errors.map(clean), ...said.map(clean)].filter(Boolean))];
}

/** The dialog open on the page: the last visible one of the app's dialogs (its modal layer, a form of tokens). */
function dialog(page) {
  return page.locator('div[class*="main_ui_modal__modal-wrapper"] > *, [data-testid$="-modal"]').filter({ visible: true }).last();
}

/** The words of the open dialog, in one line, or '' when none is open. */
async function dialogText(page) {
  const dlg = dialog(page);
  if (!(await dlg.count())) return '';
  return clean(await dlg.innerText({ timeout: 2000 }).catch(() => ''));
}

/** A control of the open dialog by its words: a button, or an input of the type button or submit. */
async function dialogControl(page, words) {
  const dlg = dialog(page);
  const button = dlg.getByRole('button', { name: exactly(words) });
  if (await button.count()) return button.last();
  const inputs = dlg.locator('input[type="button"], input[type="submit"]');
  const n = await inputs.count();
  for (let i = 0; i < n; i += 1) {
    if (normal(await inputs.nth(i).inputValue().catch(() => '')) === normal(words)) return inputs.nth(i);
  }
  return null;
}

/** The words of the controls the open dialog offers. */
async function dialogControls(page) {
  return dialog(page).locator('button, input[type="button"], input[type="submit"]').filter({ visible: true })
    .evaluateAll((es) => es.map((e) => (e.value || e.innerText || e.getAttribute('aria-label') || '').trim()).filter(Boolean)).catch(() => []);
}

/** Press a control of the open dialog by its words. */
async function pressInDialog(world, words) {
  const page = world.page;
  if (!(await dialog(page).count())) {
    throw friendly({ message: `No dialog is open: ${await pageSummary(page)}.`, hint: 'A dialog opens from the action before it: a delete asks first, an invitation has its form.' });
  }
  const control = await dialogControl(page, words);
  if (!control) {
    throw friendly({ message: `The dialog has no button "${words}". It offers ${listed(await dialogControls(page))}.`, hint: 'Name the button as it is written (letter case aside).' });
  }
  await control.click();
  await settle(page, budget(world));
}

/** The items of the menus open on the page (a context menu, the options of a card, the main menu): their words. */
async function openMenuItems(page) {
  const fromRoles = await page.getByRole('menu').filter({ visible: true }).getByRole('menuitem').filter({ visible: true }).allInnerTexts().catch(() => []);
  const fromLists = await page.locator('ul[class*="menu"] > li, [data-testid="context-menu"] li').filter({ visible: true }).allInnerTexts().catch(() => []);
  return [...new Set([...fromRoles, ...fromLists].map((t) => clean(String(t).split('\n')[0])).filter(Boolean))];
}

/** An item of the open menus by its words, or null. */
async function menuItem(page, words) {
  const candidates = [
    page.getByRole('menu').filter({ visible: true }).getByRole('menuitem').filter({ visible: true }),
    page.locator('ul[class*="menu"] > li, [data-testid="context-menu"] li').filter({ visible: true }),
  ];
  for (const items of candidates) {
    const n = await items.count();
    for (let i = n - 1; i >= 0; i -= 1) {
      const text = clean(String(await items.nth(i).innerText().catch(() => '')).split('\n')[0]);
      if (normal(text) === normal(words)) return items.nth(i);
    }
  }
  return null;
}

/** Wait for a menu to open, then choose its item by its words. */
async function chooseInMenu(world, words) {
  const page = world.page;
  await page.getByRole('menu').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  const item = await eventually(page, () => menuItem(page, words), (found) => !!found, async () => ({
    message: `The menu has no "${words}". It offers ${listed(await openMenuItems(page))}.`,
    hint: 'Open the menu first; name its item as it is written. What a menu offers follows the role of the account.',
  }), budget(world));
  await item.click();
  await settle(page, budget(world));
}

// ---------------------------------------------------------------------------
// The users registry
// ---------------------------------------------------------------------------

/** An account of the users registry, by its handle: { handle, email, password, name }. The site logs in with the address. */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { email: '${handle}@example.com', password: process.env.${String(handle).toUpperCase()}_PASSWORD, name: '…' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  const email = entry.email || entry.username;
  if (!email || !entry.password) {
    throw friendly({ message: `The user "${handle}" has no ${email ? 'password' : 'address'} in the users registry.`, hint: `Set worldParameters.users.${handle}.email and .password in cucumber.js.` });
  }
  return { handle, email, password: entry.password, name: entry.name || entry.fullname || '' };
}

/** A handle of the registry, or an address as it is (a scenario may name an address of its own). */
function addressOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  if (users[who]) return resolveUser(world, who).email;
  return who;
}

/** The name an account shows (its full name), from a handle of the registry, or the text as it is. */
function nameOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  if (users[who]) return resolveUser(world, who).name || who;
  return who;
}

/** The handle of the account that prepares and removes test content: `manager` of cucumber.js, else `owner`. */
function managerHandle(world) {
  return (world.parameters && world.parameters.manager) || 'owner';
}

// ---------------------------------------------------------------------------
// The site's API, as an account (what a Given step prepares or removes)
// ---------------------------------------------------------------------------

/** A browser context of its own, logged in to the API as an account: { context, call(cmd, params), user }. */
async function apiAs(world, handle) {
  const user = resolveUser(world, handle);
  const browser = world.browser || world.playwrightBrowser || (world.page && world.page.context().browser());
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const call = async (cmd, params = {}) => {
    let res;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      res = await context.request.post(absolute(world, `/api/main/methods/${cmd}`), { data: params, headers: { Accept: 'application/json' }, failOnStatusCode: false, timeout: budget(world) * 3 })
        .catch((err) => ({ status: () => 0, text: async () => String(err && err.message) }));
      if (![0, 429, 502, 503, 504].includes(res.status())) break;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    const body = await res.text().catch(() => '');
    if (res.status() >= 400 || res.status() === 0) {
      throw friendly({ message: `The site's API answered ${res.status()} to ${cmd} as "${handle}": ${body.slice(0, 200)}.`, hint: 'The test content is prepared and removed through the API as the managing account (manager in cucumber.js): check the account and the site.' });
    }
    try { return body ? JSON.parse(body) : null; } catch (err) { return body; }
  };
  try {
    await call('login-with-password', { email: user.email, password: user.password });
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }
  return { context, call, user };
}

/** Do something through the API as an account, then close its context. */
async function withApi(world, handle, fn) {
  const api = await apiAs(world, handle);
  try {
    return await fn(api.call, api);
  } finally {
    await api.context.close().catch(() => {});
  }
}

/** The teams an account is in, by name ("Personal Projects" is the account's own team, "Default" to the API). */
async function teamsOf(call) {
  return (await call('get-teams')).map((t) => ({ ...t, label: t.isDefault ? 'Personal Projects' : t.name }));
}

/** A team of an account by its name, or null. */
async function findTeam(call, name) {
  return (await teamsOf(call)).find((t) => normal(t.label) === normal(name) || normal(t.name) === normal(name)) || null;
}

/** The projects of a team that are not deleted (a deleted one stays in the answer for a week, with the date it goes). */
async function liveProjects(call, teamId) {
  return (await call('get-projects', { teamId })).filter((p) => !p.deletedAt);
}

/** A project by name in a team (its own name, or "Drafts" for the team's drafts), or null. */
async function findProject(call, teamId, name) {
  return (await liveProjects(call, teamId)).find((p) => (p.isDefault ? normal(name) === 'drafts' : normal(p.name) === normal(name))) || null;
}

/** The files of a team, with their project: [{ id, name, projectId, projectName }]. */
async function teamFiles(call, teamId) {
  const out = [];
  for (const project of await liveProjects(call, teamId)) {
    for (const f of await call('get-project-files', { projectId: project.id })) {
      out.push({ ...f, projectId: project.id, projectName: project.isDefault ? 'Drafts' : project.name });
    }
  }
  return out;
}

/** The team the steps work in: the one the scenario opened, else `team` of cucumber.js. */
function currentTeamName(world) {
  return world.__team || (world.parameters && world.parameters.team) || '';
}

/** The team of the scenario as the managing account sees it, or a failure naming the teams there are. */
async function managedTeam(world, call, name) {
  const teamName = name || currentTeamName(world);
  const team = await findTeam(call, teamName);
  if (!team) {
    throw friendly({ message: `The managing account is in no team "${teamName}". Its teams: ${listed((await teamsOf(call)).map((t) => t.label))}.`, hint: 'The build makes the team "Design team" with the default accounts; set team in cucumber.js to another one.' });
  }
  return team;
}

/** Remove files for good from a team's trash (a deleted file stays there for a week). */
async function purgeTrash(call, teamId, matches) {
  const soon = new Date(Date.now() + 120000).toISOString();
  const deleted = (await call('get-team-deleted-files', { teamId })).filter((d) => (!matches || matches(d)) && (d.willBeDeletedAt || '9999') > soon);
  if (deleted.length) await call('permanently-delete-team-files', { teamId, ids: deleted.map((d) => d.id) });
  return deleted.length;
}

// ---------------------------------------------------------------------------
// Sessions: log in once per account and run, take the session over after
// ---------------------------------------------------------------------------

const SESSIONS = new Map();

function sessionKey(world, email) {
  return `${siteRoot(world)}|${String(email).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

function forgetSession(world, email) {
  if (email) SESSIONS.delete(sessionKey(world, email));
}

/** Who the browser's session is: the address of its profile, or '' for a visitor. */
async function signedInEmail(world, page) {
  const res = await page.request.post(absolute(world, '/api/main/methods/get-profile'), { data: {}, headers: { Accept: 'application/json' }, failOnStatusCode: false, timeout: budget(world) }).catch(() => null);
  if (!res || res.status() !== 200) return '';
  const p = await res.json().catch(() => ({}));
  const anonymous = !p.email || p.id === '00000000-0000-0000-0000-000000000000';
  return anonymous ? '' : String(p.email);
}

const LOGIN_HINT = 'The login page (/?screen=auth-login) has the fields "Work email" and "Password" and the button "Continue". Check launchUrl in cucumber.js, and that the build of the site made the account.';

/**
 * Fill in the login form and send it when it can be sent, then read its outcome: the dashboard, or the errors the
 * form writes (a malformed address keeps the button disabled, with its error under the field).
 */
async function submitLogin(world, page, email, password) {
  await page.context().clearCookies();
  await openIn(page, screenUrl(world, 'auth-login'), budget(world) * 3);
  const emailField = page.getByRole('textbox', { name: 'Work email' });
  try {
    await emailField.waitFor({ state: 'visible', timeout: budget(world) * 2 });
  } catch (err) {
    throw friendly({ message: `The login form did not appear: ${await pageSummary(page)}.`, cause: err, hint: hintFor(page, LOGIN_HINT) });
  }
  await emailField.fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('textbox', { name: 'Password' }).blur().catch(() => {});
  const button = page.getByRole('button', { name: 'Continue' });
  await page.waitForTimeout(200);
  if (!(await button.isEnabled().catch(() => false))) {
    return { ok: false, sent: false, errors: await formErrors(page) };
  }
  await button.click({ timeout: budget(world) });
  const outcome = await Promise.race([
    page.waitForURL((url) => /screen=(dashboard|workspace|settings)/.test(url.search), { timeout: budget(world) * 3 }).then(() => 'in'),
    page.locator('[class*="context_notification"], [class*="forms__error"]').filter({ visible: true }).first().waitFor({ timeout: budget(world) * 3 }).then(() => 'refused'),
  ]).catch(() => 'unknown');
  await settle(page, budget(world));
  if (outcome === 'in') return { ok: true, sent: true, errors: [] };
  return { ok: false, sent: true, errors: await formErrors(page) };
}

/** Log a browser in as an account of the registry, through the form, and keep its session for later scenarios. */
async function logInPage(world, page, user) {
  const outcome = await submitLogin(world, page, user.email, user.password);
  if (!outcome.ok) {
    throw friendly({
      message: `"${user.handle}" (${user.email}) could not log in: ${outcome.errors.length ? `the site says ${listed(outcome.errors)}` : await pageSummary(page)}.`,
      hint: hintFor(page, `Check the account in the users registry of cucumber.js and on the site (the build makes it). ${LOGIN_HINT}`),
    });
  }
  SESSIONS.set(sessionKey(world, user.email), await page.context().cookies());
}

/** Take over in a browser the session an account opened earlier in this run. */
async function restoreSessionIn(world, page, user) {
  const cookies = SESSIONS.get(sessionKey(world, user.email));
  if (!cookies || !reuseSessions(world)) return false;
  const context = page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  if ((await signedInEmail(world, page)).toLowerCase() === user.email.toLowerCase()) return true;
  forgetSession(world, user.email);
  await context.clearCookies();
  return false;
}

/** Log the scenario's browser in as a handle of the registry: the session of an earlier login when there is one, else the form. */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (world.__account === user.email && (await signedInEmail(world, world.page)).toLowerCase() === user.email.toLowerCase()) return user;
  if (await restoreSessionIn(world, world.page, user)) {
    // A page the browser shows still holds what the session before drew: open the dashboard, where a login lands.
    if (!/^about:/.test(world.page.url())) await open(world, '/');
  } else {
    await logInPage(world, world.page, user);
  }
  world.__account = user.email;
  world.__accountHandle = handle;
  return user;
}

// ---------------------------------------------------------------------------
// The dashboard: a team, its projects and their files
// ---------------------------------------------------------------------------

/** Fold the panel "Libraries & Templates" when it is open: it lies over the bottom of the projects and takes their clicks. */
async function hideTemplates(page) {
  const panel = page.locator('[class*="dashboard_templates__dashboard-templates-section"]');
  if (!(await panel.count())) return;
  const box = await panel.boundingBox().catch(() => null);
  const view = page.viewportSize() || { height: 900 };
  if (box && box.y < view.height - 60) {
    await page.locator('[class*="dashboard_templates__title-btn"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

/** The teams the browser's account is in, through the API of its session: [{ id, name, label, isDefault }]. */
async function sessionTeams(world) {
  const res = await world.page.request.post(absolute(world, '/api/main/methods/get-teams'), { data: {}, headers: { Accept: 'application/json' }, failOnStatusCode: false }).catch(() => null);
  const list = res && res.status() === 200 ? await res.json().catch(() => []) : [];
  return (Array.isArray(list) ? list : []).map((t) => ({ ...t, label: t.isDefault ? 'Personal Projects' : t.name }));
}

/** Open the dashboard of a team (its projects), as the scenario's account. */
async function openTeam(world, name) {
  const page = world.page;
  const list = await sessionTeams(world);
  const found = list.find((t) => normal(t.label) === normal(name) || normal(t.name) === normal(name));
  if (!found) {
    throw friendly({ message: `The account is in no team "${name}". Its teams: ${listed(list.map((t) => t.label))}.`, hint: 'The build makes the team "Design team" and adds the default accounts to it.' });
  }
  world.__team = found.label;
  world.__teamId = found.id;
  await open(world, screenUrl(world, 'dashboard-recent', { 'team-id': found.id }).replace(siteRoot(world), ''));
  await page.getByTestId('dashboard-sidebar').waitFor({ state: 'visible', timeout: budget(world) * 3 }).catch(() => {});
  await page.getByTestId('dashboard-header').or(page.locator('main article')).first().waitFor({ state: 'visible', timeout: budget(world) * 2 }).catch(() => {});
  await hideTemplates(page);
  return found;
}

/** Make sure the scenario's page is the dashboard: the team it opened, else the team of cucumber.js, else where a login lands. */
async function onDashboard(world) {
  const page = world.page;
  if (!/^dashboard/.test(screenOf(page))) {
    const team = currentTeamName(world);
    if (team) await openTeam(world, team);
    else await open(world, '/');
  }
  // The app draws the dashboard once its data came: a screen still loading is waited for, not taken for another.
  await page.getByTestId('dashboard-sidebar').waitFor({ state: 'visible', timeout: budget(world) * 2 }).catch(() => {});
  if (!(await page.getByTestId('dashboard-sidebar').count())) {
    throw friendly({ message: `The dashboard is not open: ${await pageSummary(page)}.`, hint: 'Log in first, then open a team: When I open the team "Design team".' });
  }
  await hideTemplates(page);
}

/** The project cards of the dashboard: [{ name, files: [names] }]. */
async function projectCards(page) {
  return page.locator('main article').evaluateAll((arts) => arts.map((a) => ({
    name: ((a.querySelector('h2') || {}).innerText || '').trim(),
    files: [...a.querySelectorAll('h3[class*="grid-item-title"]')].map((e) => (e.innerText || '').trim()).filter(Boolean),
  }))).catch(() => []);
}

/** A project's card on the dashboard by its name (its heading). */
function projectCard(page, name) {
  return page.locator('main article').filter({ has: page.getByRole('heading', { level: 2, name: exactly(name) }) }).first();
}

/** A file's card (a button named by the file) on the screen. */
function fileCard(page, name) {
  return page.locator('main').getByRole('button', { name: exactly(name) }).filter({ has: page.locator('h3[class*="grid-item-title"]') }).first();
}

/** The names of the files the screen shows (cards of a project, drafts, libraries, search results, the trash). */
async function fileTitles(page) {
  return (await page.locator('main h3[class*="grid-item-title"]').filter({ visible: true }).allInnerTexts().catch(() => [])).map(clean);
}

// ---------------------------------------------------------------------------
// The workspace: a file, its pages, its layers, its tools and panels
// ---------------------------------------------------------------------------

/** Wait until the workspace drew a file: its viewport and its layers (or, for a viewer, its viewport alone). */
async function waitWorkspace(world) {
  const page = world.page;
  try {
    await page.getByTestId('viewport').waitFor({ state: 'visible', timeout: budget(world) * 3 });
  } catch (err) {
    throw friendly({ message: `The workspace did not open: ${await pageSummary(page)}.`, cause: err, hint: hintFor(page, 'Open a file first (When I open the file "Homepage"); the account must be a member of its team.') });
  }
  await page.getByTestId('layer-tree').or(page.getByTestId('left-sidebar')).first().waitFor({ state: 'visible', timeout: budget(world) * 2 }).catch(() => {});
  await settle(page, budget(world));
}

/** Find a file the browser's account sees by its name, through the API of its session: { file, teamId, projectId } or null. */
async function findSessionFile(world, name) {
  const page = world.page;
  const post = (cmd, data) => page.request.post(absolute(world, `/api/main/methods/${cmd}`), { data, headers: { Accept: 'application/json' }, failOnStatusCode: false })
    .then((r) => (r.status() === 200 ? r.json() : [])).catch(() => []);
  for (const team of await sessionTeams(world)) {
    for (const project of (await post('get-projects', { teamId: team.id })).filter((p) => !p.deletedAt)) {
      const file = (await post('get-project-files', { projectId: project.id })).find((f) => normal(f.name) === normal(name));
      if (file) return { file, teamId: team.id, projectId: project.id };
    }
  }
  return null;
}

/** Open a file by its name in the workspace (at a page of its own when `pageId` is given). */
async function openFile(world, name, { pageId } = {}) {
  const found = await findSessionFile(world, name);
  if (!found) {
    throw friendly({ message: `The account sees no file "${name}".`, hint: 'The build makes Homepage and Pricing page (Website redesign), Style guide (Brand) and Sketches (the team\'s drafts); a scenario makes its own with "Given there is a file …".' });
  }
  const params = { 'team-id': found.teamId, 'file-id': found.file.id };
  if (pageId) params['page-id'] = pageId;
  await open(world, screenUrl(world, 'workspace', params).replace(siteRoot(world), ''));
  await waitWorkspace(world);
  world.__file = { ...found.file, teamId: found.teamId, projectId: found.projectId };
  return world.__file;
}

/** Make sure the scenario's page is the workspace. */
async function inWorkspace(world) {
  const page = world.page;
  if (screenOf(page) !== 'workspace' || !(await page.getByTestId('viewport').count())) {
    throw friendly({ message: `No file is open: ${await pageSummary(page)}.`, hint: 'Open a file first: When I open the file "Homepage".' });
  }
}

/** Show a tab of the left side bar ("Layers", "Assets", "Tokens"). */
async function leftTab(world, name) {
  const page = world.page;
  const tab = page.getByTestId('left-sidebar').getByRole('tab', { name: exactly(name) });
  if (!(await tab.count())) {
    const offered = await page.getByTestId('left-sidebar').getByRole('tab').allInnerTexts().catch(() => []);
    throw friendly({ message: `The side bar of the workspace has no tab "${name}". It has ${listed(offered)}.`, hint: 'The left side bar has the tabs Layers, Assets and Tokens.' });
  }
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
    await settle(page, budget(world));
  }
}

/**
 * Open every folded parent of the layer tree, so each layer has its row. An open parent's button says so
 * (aria-expanded="true", and its class "expanded"); a folded one does not.
 */
async function unfoldLayers(page) {
  for (let round = 0; round < 6; round += 1) {
    const folded = await page.getByTestId('layer-tree').getByTestId('toggle-content').evaluateAll((bs) => bs
      .map((b, i) => ({ i, open: b.getAttribute('aria-expanded') === 'true' || /\bexpanded\b|toggle-content-expanded|__expanded/.test(String(b.className)) }))
      .filter((b) => !b.open).map((b) => b.i)).catch(() => []);
    if (!folded.length) return;
    const buttons = page.getByTestId('layer-tree').getByTestId('toggle-content');
    for (const i of folded.reverse()) await buttons.nth(i).click().catch(() => {});
    await page.waitForTimeout(250);
  }
}

/** The layers of the open page, by their rows: [{ name, id, selected, component, variant }]. */
async function layers(page) {
  return page.getByTestId('layer-tree').getByTestId('layer-row').evaluateAll((rows) => rows.map((r) => ({
    name: ((r.innerText || '').split('\n')[0] || '').trim(),
    id: r.getAttribute('id'),
    selected: r.getAttribute('aria-checked') === 'true',
    component: !!r.querySelector('[data-testid="icon-component"]'),
    variant: !!r.querySelector('[data-testid="icon-variant"]'),
  }))).catch(() => []);
}

/** The names of the layers that are selected. */
async function selectedLayers(page) {
  return (await layers(page)).filter((l) => l.selected).map((l) => l.name);
}

/** A layer's row in the layer tree by its name (the n-th of that name, from 1). */
function layerRow(page, name, nth = 1) {
  return page.getByTestId('layer-tree').getByRole('checkbox', { name: exactly(name) }).nth(nth - 1);
}

/** The row of a layer, unfolding its parents when it is not in the tree yet; a failure names the layers there are. */
async function findLayer(world, name) {
  const page = world.page;
  await leftTab(world, 'Layers');
  let row = page.getByTestId('layer-tree').getByRole('checkbox', { name: exactly(name) }).first();
  if (!(await row.count())) {
    await unfoldLayers(page);
    row = page.getByTestId('layer-tree').getByRole('checkbox', { name: exactly(name) }).first();
  }
  if (!(await row.count())) {
    throw friendly({ message: `The page has no layer "${name}". Its layers: ${listed((await layers(page)).map((l) => l.name))}.`, hint: 'A layer is named after what made it ("Board", "Rectangle", the words of a text) until it is renamed.' });
  }
  return row;
}

/** Select a layer by its row in the layer tree (with Shift: add it to the selection). */
async function selectLayer(world, name, { add = false } = {}) {
  const page = world.page;
  const row = await findLayer(world, name);
  await row.click(add ? { modifiers: ['Shift'] } : {});
  await eventually(page, () => selectedLayers(page), (names) => names.some((n) => normal(n) === normal(name)), async (names) => ({
    message: `The layer "${name}" did not get selected. Selected: ${listed(names)}.`,
    hint: 'A click on a layer\'s row selects it; Shift adds it to the selection.',
  }), budget(world));
}

/** The box of a layer's shape on the screen ({ x, y, width, height }), from its row's id. */
async function shapeBox(world, name) {
  const page = world.page;
  const row = await findLayer(world, name);
  const id = await row.getAttribute('id');
  const shape = page.locator(`[data-testid="viewport"] g[id="shape-${id}"]`).first();
  await shape.scrollIntoViewIfNeeded().catch(() => {});
  const box = await shape.boundingBox().catch(() => null);
  const view = await page.getByTestId('viewport').boundingBox();
  if (!box || !view || box.width < 8 || box.height < 8 || box.x + box.width < view.x || box.y + box.height < view.y || box.x > view.x + view.width || box.y > view.y + view.height) {
    throw friendly({ message: `The layer "${name}" is not on the screen (its box: ${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'none'}).`, hint: 'Zoom to fit the page first (Shift+1), or work on a board that the viewport shows.' });
  }
  return box;
}

/**
 * An empty spot of the canvas for a shape of `width` by `height` pixels: { x, y } on the screen, or null. It keeps
 * clear of the shapes and of what lies over the canvas (the toolbar at the top, the palettes at the bottom).
 */
async function emptySpot(page, width, height) {
  const view = await page.getByTestId('viewport').boundingBox();
  if (!view) return null;
  const shapes = await page.locator('[data-testid="viewport"] g[id^="shape-"]').evaluateAll((gs) => gs
    .filter((g) => g.id !== 'shape-00000000-0000-0000-0000-000000000000')
    .map((g) => { const b = g.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })
    .filter((b) => b.w > 0 && b.h > 0)).catch(() => []);
  const overlays = await page.locator('[role="toolbar"], [data-testid="palette"], [class*="top_toolbar"], [class*="palette__"]').evaluateAll((es) => es
    .map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })
    .filter((b) => b.w > 0 && b.h > 0)).catch(() => []);
  const obstacles = [...shapes, ...overlays];
  const margin = 24;
  for (let y = view.y + 60; y + height < view.y + view.height - 40; y += 40) {
    for (let x = view.x + 60; x + width < view.x + view.width - 40; x += 40) {
      const free = obstacles.every((s) => x + width + margin < s.x || x - margin > s.x + s.w || y + height + margin < s.y || y - margin > s.y + s.h);
      if (free) return { x, y };
    }
  }
  return null;
}

/** Drag on the canvas from a point by a size, in steps so the app sees the movement. */
async function dragOnCanvas(page, from, width, height) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + width / 2, from.y + height / 2, { steps: 5 });
  await page.mouse.move(from.x + width, from.y + height, { steps: 5 });
  await page.mouse.up();
}

/** The tools of the workspace: their toolbar button, the flyout they sit in, the layer they make. */
const TOOLS = {
  board: { button: 'Board (B)', layer: 'Board' },
  rectangle: { button: 'Rectangle (R)', layer: 'Rectangle' },
  ellipse: { button: 'Ellipse (E)', flyout: 'Rectangle (R)', layer: 'Ellipse' },
  text: { button: 'Text (T)', layer: null },
  path: { button: 'Path (P)', layer: 'Path' },
};

/** Choose a tool on the toolbar ("Drawing tools"): its button, or its item in the flyout of another. */
async function chooseTool(world, toolName) {
  const page = world.page;
  const tool = TOOLS[normal(toolName)];
  if (!tool) throw friendly({ message: `There is no tool "${toolName}" in this pack's steps.`, hint: `The tools: ${Object.keys(TOOLS).join(', ')}.` });
  const toolbar = page.getByRole('toolbar', { name: 'Drawing tools' });
  if (!(await toolbar.count())) {
    throw friendly({ message: 'The workspace shows no toolbar "Drawing tools".', hint: 'A viewer of a team has no drawing tools: log in as an editor, an admin or the owner.' });
  }
  if (tool.flyout) {
    const trigger = toolbar.getByRole('button', { name: tool.flyout }).first();
    await trigger.hover();
    const item = page.getByRole('menuitemradio', { name: tool.button });
    await item.waitFor({ state: 'visible', timeout: budget(world) });
    await item.click();
  } else {
    await toolbar.getByRole('button', { name: tool.button }).first().click();
  }
  await page.waitForTimeout(150);
  return tool;
}

/** Wait until the layer tree has more rows than before; return the newest layers' names. */
async function waitNewLayer(world, before, what) {
  const page = world.page;
  return eventually(page, () => layers(page), (now) => now.length > before.length, async (now) => ({
    message: `No new layer came after ${what}. The layers: ${listed(now.map((l) => l.name))}.`,
    hint: 'The tool draws on a drag over an empty part of the canvas, once the file has loaded; a viewer cannot draw.',
  }), budget(world) * 2);
}

/** A text box of the Design or Inspect panels by its name ("Width", "Height", "X axis", "Rotation", …). */
function designInput(page, name) {
  return page.getByTestId('right-sidebar').getByRole('textbox', { name: exactly(name) }).first();
}

/** The value a Design input shows: its value, or its placeholder when it holds none ("Mixed" for a selection of several). */
async function designValue(page, name) {
  const input = designInput(page, name);
  if (!(await input.count())) return null;
  const value = await input.inputValue().catch(() => '');
  return value !== '' ? value : (await input.getAttribute('placeholder').catch(() => '')) || '';
}

/** Show a tab of the right side bar ("Design", "Prototype", "Inspect"). */
async function rightTab(world, name) {
  const page = world.page;
  const tab = page.getByTestId('right-sidebar').getByRole('tab', { name: exactly(name) });
  if (!(await tab.count())) {
    const offered = await page.getByTestId('right-sidebar').getByRole('tab').allInnerTexts().catch(() => []);
    throw friendly({ message: `The right side bar has no tab "${name}". It has ${listed(offered)}.`, hint: 'The tabs are Design, Prototype and Inspect; a viewer sees the Inspect panel alone.' });
  }
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
    await settle(page, budget(world));
  }
}

/** The panels of the Inspect tab (or of the view mode's inspect): [{ title, text, rows: [[term, definition]] }]. */
async function inspectPanels(page, scope) {
  const root = scope || page;
  return root.getByRole('article').evaluateAll((arts) => arts.map((a) => {
    const title = ((a.innerText || '').split('\n').map((t) => t.trim()).find(Boolean) || '');
    const terms = [...a.querySelectorAll('dt, [role="term"]')].map((dt) => {
      let dd = dt.nextElementSibling;
      while (dd && !(dd.tagName === 'DD' || dd.getAttribute('role') === 'definition')) dd = dd.nextElementSibling;
      return [(dt.innerText || '').trim(), dd ? (dd.innerText || '').replace(/\s+/g, ' ').trim() : ''];
    });
    return { title, text: (a.innerText || '').replace(/\s+/g, ' ').trim(), rows: terms };
  })).catch(() => []);
}

/** Open a top item of the workspace's main menu ("File", "Edit", "View", …) and return the items it shows. */
async function openMainMenu(world, top) {
  const page = world.page;
  await inWorkspace(world);
  // A menu left open goes first (Escape on the canvas would drop the selection: only with a menu open).
  for (let i = 0; i < 3 && (await openMenuItems(page)).length; i += 1) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Main menu' }).click();
  const id = `#file-menu-${normal(top).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`;
  const topItem = page.locator(id).or(page.locator('ul[class*="menu"] > li').filter({ hasText: exactly(top) })).first();
  try {
    await topItem.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The main menu has no "${top}". It offers ${listed(await openMenuItems(page))}.`, hint: 'The main menu holds File, Edit, View, Preferences, Plugins and Help & info.' });
  }
  await topItem.hover();
  await page.waitForTimeout(300);
  return topItem;
}

/** The items of a submenu of the main menu (those after its top items). */
async function mainMenuItems(world, top) {
  const page = world.page;
  await openMainMenu(world, top);
  const all = await page.locator('ul[class*="menu"] > li, [role="menu"] [role="menuitem"]').filter({ visible: true })
    .evaluateAll((es) => es.map((e) => ({ text: (e.innerText || '').split('\n')[0].trim(), id: e.id || '' })));
  return all.filter((i) => !/^file-menu-(file|edit|view|preferences|plugins|help-info)$/.test(i.id)).map((i) => i.text).filter(Boolean);
}

/** Choose an item of a submenu of the main menu ("File" › "Export boards as PDF"). */
async function chooseInMainMenu(world, top, words) {
  const page = world.page;
  const items = await mainMenuItems(world, top);
  const item = page.locator('ul[class*="menu"] > li, [role="menu"] [role="menuitem"]').filter({ visible: true }).filter({ hasText: new RegExp(`^\\s*${escapeRegExp(words)}`, 'i') }).last();
  if (!items.some((i) => normal(i) === normal(words)) || !(await item.count())) {
    await page.keyboard.press('Escape').catch(() => {});
    throw friendly({ message: `The menu "${top}" has no "${words}". It offers ${listed(items)}.`, hint: 'What the main menu offers follows the role of the account: a viewer has no "Add as Shared Library", no "Undo".' });
  }
  await item.click();
  await settle(page, budget(world));
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/** A folder of its own for the files a run downloads. */
function downloadDir() {
  const dir = path.join(os.tmpdir(), `webship-dl-${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Do something that downloads a file and keep the file for webship-js's download steps (`this._lastDownload`). */
async function captureDownload(world, page, action, what) {
  let download;
  try {
    [download] = await Promise.all([page.waitForEvent('download', { timeout: budget(world) * 6 }), action()]);
  } catch (err) {
    throw friendly({ message: `${what} downloaded nothing.`, cause: err, hint: 'The site exports the file in its exporter service: check that it runs (the build starts it).' });
  }
  const filename = download.suggestedFilename();
  const file = path.join(downloadDir(), filename);
  await download.saveAs(file);
  world._lastDownload = { path: file, filename, content: fs.readFileSync(file) };
  return world._lastDownload;
}

// ---------------------------------------------------------------------------
// Mail (a Mailpit the site sends to)
// ---------------------------------------------------------------------------

/** The mail catcher's address: `mailUrl` of cucumber.js, else MAIL_URL, else the site's address on port 8026. */
function mailUrl(world) {
  const configured = (world.parameters && world.parameters.mailUrl) || process.env.MAIL_URL;
  if (configured) return String(configured).replace(/\/+$/, '');
  return `${siteRoot(world)}:8026`;
}

/** The messages to an address since the scenario began, newest first: [{ ID, Subject, Created }]. */
async function mailTo(world, address) {
  const page = world.page;
  const since = world.__scenarioStartedAt || 0;
  const res = await page.request.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=50`, { failOnStatusCode: false, timeout: budget(world) }).catch(() => null);
  if (!res || res.status() !== 200) {
    throw friendly({ message: `The mail catcher at ${mailUrl(world)} did not answer (${res ? res.status() : 'no answer'}).`, hint: 'Set mailUrl in cucumber.js to the Mailpit the site sends its mail to (DDEV: the site\'s address on port 8026).' });
  }
  const data = await res.json().catch(() => ({ messages: [] }));
  return (data.messages || []).filter((m) => Date.parse(m.Created) >= since - 5000);
}

/** One message of the mail catcher, whole: { Subject, Text, HTML }. */
async function mailMessage(world, id) {
  const res = await world.page.request.get(`${mailUrl(world)}/api/v1/message/${id}`, { failOnStatusCode: false, timeout: budget(world) });
  return res.json();
}

/** The links of a message, from its text and its HTML. */
function mailLinks(message) {
  const all = `${message.Text || ''}\n${message.HTML || ''}`;
  return [...new Set((all.match(/https?:\/\/[^\s"'<>)]+/g) || []).map((u) => u.replace(/&amp;/g, '&')))];
}

/** The text of a message, in one line. */
function mailText(message) {
  return clean(message.Text || String(message.HTML || '').replace(/<[^>]+>/g, ' '));
}

/** Wait for a message to an address whose subject contains a text; the failure lists the subjects there are. */
async function waitForMail(world, address, subject) {
  const page = world.page;
  return eventually(page, () => mailTo(world, address), (list) => list.some((m) => mentions(m.Subject, subject)), async (list) => ({
    message: `No email with the subject "${subject}" came to ${address} since the scenario began. It got ${listed(list.map((m) => m.Subject))}.`,
    hint: 'The site sends its mail to the mail catcher (mailUrl in cucumber.js); an invitation goes only to an address that has no account yet.',
  }), budget(world) * 6).then((list) => list.find((m) => mentions(m.Subject, subject)));
}

// ---------------------------------------------------------------------------
// Hooks: messages recorded on every page; what a scenario changed on an account goes back
// ---------------------------------------------------------------------------

onNewPage(async (world, page) => {
  await recordToasts(page);
});

Before(function () {
  this.__account = null;
  this.__accountHandle = null;
  this.__team = null;
  this.__teamId = null;
  this.__file = null;
  this.__restore = [];
  this.__scenarioStartedAt = Date.now();
});

// A role a scenario changed, an onboarding it reset: put back through the API, whatever the outcome.
After({ timeout: 120000 }, async function () {
  const restore = (this.__restore || []).reverse();
  this.__restore = [];
  for (const job of restore) {
    try { await job(); } catch (err) { /* reported by the build's tidy at the latest */ }
  }
  for (const extra of this.__extraContexts || []) await extra.close().catch(() => {});
  this.__extraContexts = [];
});

module.exports = {
  budget,
  clean,
  normal,
  mentions,
  listed,
  escapeRegExp,
  exactly,
  siteRoot,
  absolute,
  screenUrl,
  screenOf,
  cutRequest,
  CUT_HINT,
  hintFor,
  settle,
  openIn,
  open,
  profileButton,
  eventually,
  heading,
  pageSummary,
  recordToasts,
  messages,
  formErrors,
  dialog,
  dialogText,
  dialogControl,
  dialogControls,
  pressInDialog,
  openMenuItems,
  menuItem,
  chooseInMenu,
  resolveUser,
  addressOf,
  nameOf,
  managerHandle,
  apiAs,
  withApi,
  teamsOf,
  findTeam,
  liveProjects,
  findProject,
  teamFiles,
  currentTeamName,
  managedTeam,
  purgeTrash,
  SESSIONS,
  sessionKey,
  forgetSession,
  signedInEmail,
  submitLogin,
  logInPage,
  restoreSessionIn,
  logInAs,
  hideTemplates,
  sessionTeams,
  openTeam,
  onDashboard,
  projectCards,
  projectCard,
  fileCard,
  fileTitles,
  waitWorkspace,
  findSessionFile,
  openFile,
  inWorkspace,
  leftTab,
  unfoldLayers,
  layers,
  selectedLayers,
  layerRow,
  findLayer,
  selectLayer,
  shapeBox,
  emptySpot,
  dragOnCanvas,
  TOOLS,
  chooseTool,
  waitNewLayer,
  designInput,
  designValue,
  rightTab,
  inspectPanels,
  openMainMenu,
  mainMenuItems,
  chooseInMainMenu,
  downloadDir,
  captureDownload,
  mailUrl,
  mailTo,
  mailMessage,
  mailLinks,
  mailText,
  waitForMail,
};
