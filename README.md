<p align="center"><img src="https://raw.githubusercontent.com/webship/penpot-steps/2.0.x/assets/logo.svg" alt="Penpot logo" width="96"></p>

# penpot-steps

[![Test](https://github.com/webship/penpot-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/penpot-steps/actions/workflows/test.yml)

Cucumber step definitions for Penpot, the open-source design and prototyping platform, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js.

Every Penpot site has the same app, whatever its teams design: the login and its onboarding, the dashboard of a team
with its projects and files, the team's members and invitations, the workspace where boards and shapes are drawn, its
layers, values, assets, tokens, comments and history, the view mode a design is reviewed in, and the exports.
`@webship-js/penpot-steps` covers them, on the open-source edition, self-hosted:

- **the session**: the login page and its refusals (a wrong password, a malformed address), logging in by a handle of
  the users registry or taking over an account's session from earlier in the run, logging out, who is logged in, the
  old addresses of the login pages, the password recovery through its mail, the registration form's refusals (an
  address already used, one that does not match its invitation), and the onboarding of a new account (the
  questionnaire, the choice of a team);
- **the dashboard**: a team and the sections of its side bar (Projects, Drafts, Libraries, Fonts), the heading of a
  screen, projects made, renamed, pinned and deleted, files made, renamed, opened, selected and deleted to the trash,
  the menus of a project and of one or two files, the search, the pinned projects, what a role is offered, the
  messages the site answers with (recorded as they come: they go after a few seconds), its questions and its dialogs;
- **the team**: teams made and deleted from the team switch, the team's options, its members and their roles (the
  owner's never changes), invitations sent (with their mail), warned about, selected and deleted;
- **the workspace**: a file opened (at its first page when the address names a page it does not have), its pages
  added, opened and renamed, the drawing tools (board, rectangle, ellipse, text, path), the layers (listed, selected,
  renamed, grouped, deleted, made components and variants), the values of the Design tab ("Mixed" for several layers)
  and the size under a selection, a fill, a stroke, a shadow and a blur added, the main menu and what a role finds in
  it, the assets and the shared libraries of the team, and the other people working in the file;
- **inspect, tokens, history and exports**: the panels of the Inspect tab and the code it writes, design tokens made,
  refused and applied, versions saved and restored, the boards exported as a PDF (its pages counted), an image
  exported from the view mode (its size checked), the file downloaded in its own format;
- **comments and the view mode**: comments written on a board, listed, hidden and shown; the boards of the view mode
  one after another, its zoom, its comments and inspect, the link it shares with people who have no account (and the
  login form once the link is destroyed);
- **the account**: the menu of the profile and its submenus, the release notes of the version, the settings and the
  keyboard shortcuts;
- **the mail** the site sends, read from the mail catcher: a mail that came, what it says, its link opened;
- **test content**: what a scenario starts from and the removal of what it made ("Webship test …"), done through the
  site's own API as a managing account, never in the scenario's browser.

No step phrase names the platform: a scenario reads `When I draw a "Rectangle" in the board "Hero"` and
`Then the inspect panel "Fill" should show "Background" as "#B1B2B5 100%"`.

The flows follow those of Penpot's own Playwright suite (see [Penpot's own tests and this pack](#penpots-own-tests-and-this-pack)),
written anew as steps that check the real site: their suite mocks the backend, this one does not.

CI builds a real site with [DDEV](https://ddev.com) on the runner, from the publisher's images, and runs the suite twice
on every push and pull request, then the assertions that must fail; see [The test site](#the-test-site) and
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, Python 3, and Node.js 24 or later with npm. The site
runs in its containers, from the publisher's images: nothing of it on the machine, no public domain and no account
anywhere.

**1. The site.** The pack's own build script (the one CI runs) makes a DDEV project with a site at the current release
(Penpot 2.19.4), four accounts in a team and the test content (see [The test site](#the-test-site)). It takes about
five minutes the first time, most of it the download of the images.

```bash
git clone https://github.com/webship/penpot-steps.git
SITE_DIR="$PWD/penpot-site" penpot-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://penpotsteps.ddev.site`, its mail catcher at `https://penpotsteps.ddev.site:8026`. The
accounts are `owner@example.com` (the owner of the team "Design team"), `admin@example.com` (an admin of it),
`editor@example.com` (an editor) and `viewer@example.com` (a viewer), each logging in with its address and the password
`dD.123123ddd`.

In the [Webship Workspace](https://github.com/webship/workspace), its Penpot plugin builds the same site instead, in a
sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and
`demos/` work the same):

```bash
bash core/scripts/plugins.sh --require penpot --with-needs
bash core/scripts/plugins.sh --activate penpot --with-needs
bash core/scripts/plugins.sh --install penpot
bash dev/cmd-penpot-project.sh penpotsite --install --add-users --sample-content
```

That site answers at `https://penpotsite.ddev.site`. Its accounts are the plugin's: the same four, at `example.com`,
with the workspace's shared password `dD.123123ddd`, and the workspace account as an account of its own. Without
`--sample-content` the site has none of the test content: the first feature below runs there too, the features of
this repository need the test content.

**2. A test project.**

```bash
mkdir penpot-tests && cd penpot-tests
npm init -y
npm install --save-dev webship-js @webship-js/penpot-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the
`npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run
changes nothing. Its first feature opens the site's front page.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the
tags that keep the assertions that must fail out of a normal run, the mail catcher, the account that prepares and
removes test content, the team the scenarios work in, and the accounts (the JSON of [Test users](#test-users)). The
first lines are the starter's own: a feature named on the command line runs alone (step 5).

```javascript
// A feature file or a scenario (file:line) named on the command line runs alone:
// cucumber-js 12 would add it to the paths below, so `paths` is left empty then.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

const launchUrl = (process.env.LAUNCH_URL || 'https://penpotsteps.ddev.site').replace(/\/+$/, '');

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/penpot-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl,
      // The mail catcher the site sends its mail to.
      mailUrl: process.env.MAIL_URL || `${launchUrl}:8026`,
      // The account that prepares and removes test content for the Given steps, through the site's API.
      manager: 'owner',
      // The team the steps work in until a scenario opens another.
      team: 'Design team',
      // Browser messages: the scenarios of a refusal the site answers with an error status (a wrong password, an
      // address already used) carry @js-off, since the browser logs that status as an error.
      javascript: { mode: 'warn', levels: ['error'], beforeScenario: false, afterScenario: true },
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        owner: { email: 'owner@example.com', password: 'dD.123123ddd', name: 'Owner Test' },
        admin: { email: 'admin@example.com', password: 'dD.123123ddd', name: 'Admin Test' },
        editor: { email: 'editor@example.com', password: 'dD.123123ddd', name: 'Editor Test' },
        viewer: { email: 'viewer@example.com', password: 'dD.123123ddd', name: 'Viewer Test' },
      },
    },
  },
};
```

On the site from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL` (step 5),
and the mail catcher follows it.

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: The editor logs in and finds the team's projects
    Given I am not logged in
    When I log in as "editor" with the login form
    Then I should be logged in as "editor"
    When I open the team "Design team"
    Then the page heading should be "Projects"

  Scenario: A viewer reads a file without the tools to change it
    Given I am a logged in user with the "viewer" user
    When I open the file "Homepage"
    Then the workspace should not show the drawing tools
    And the layers should list "Hero"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the site: `https://penpotsteps.ddev.site` for the build script's
site, `https://penpotsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://penpotsteps.ddev.site npm test
```

A green first run prints every step, then the summary (the scenarios above and the starter's, passed) and the HTML
report it wrote:

```
3 scenarios (3 passed)
11 steps (11 passed)
```

One feature runs alone when the command line names it (a scenario too, with its line):

```bash
LAUNCH_URL=https://penpotsteps.ddev.site npx cucumber-js tests/features/first-run.feature
```

From there, copy the features of [`tests/features/`](tests/features/), which ship in the package:

```bash
cp node_modules/@webship-js/penpot-steps/tests/features/*.feature tests/features/
```

They use every step of the pack, run as they are on the site of either way of step 1 (the Workspace's with
`--sample-content`), and take away what they make. Their names say what they hold (`dashboard.feature`,
`workspace.feature`, `view-mode.feature`, …): none is called like the first feature a test project or the Workspace
starts with (`check-homepage.feature`, `first-run.feature`, `site.feature`), so copying them replaces nothing.

For your own site, point `launchUrl` at it, `mailUrl` at the mail catcher its mail goes to, `manager` at an account
that owns the team the scenarios work in, `team` at that team, and `users` at its test accounts (`email` and
`password`, `name` for the steps that read a person's name). The steps read what the site draws the same way on every
site in English: a site in another language is read with webship-js's `I should see "…"` where its words differ.

### What the suite tests

The features of this repository run every step of the pack against a real site, twice in a row in CI on every change:

- `tests/features/` (54 scenarios): a visitor sent to the login page, the old addresses of the login and recovery
  pages, the link to the registration form, a login and a logout through the form, a malformed address and a wrong
  password refused, an address without an account refused; the password recovery through its mail and its link; the
  registration's refusals (an address already used, a malformed one, a short password, the link of an invitation
  given another address); the onboarding's questionnaire walked step by step, and the choice of a team; the projects
  of a team, a pinned one, the drafts, the shared libraries and their options, the fonts, the search, the menus of a
  file and of two files, the options of a project and of the team's drafts, "Move to" and the other teams; a project
  made, renamed, pinned and deleted; a file made, renamed in the workspace, opened from the dashboard and deleted to
  the trash; the members and their roles (the owner's never changes), a role changed and changed back, an address
  invited (its mail read), its invitation selected and deleted, an address of a member not invited again, a team made
  and deleted; what a viewer does not get (projects, files, fonts, the team's management, the drawing tools, the Design
  tab, "Add as Shared Library", "Undo") and what an editor gets; a new file on its first page and at an address naming
  a page it does not have, each tool of the toolbar, the values of a selection (one layer, several: "Mixed"), layers
  renamed, grouped, deleted and a change undone, pages added, opened and renamed, the main menu of an editor, a second
  person in the file; a component and the container of two variants, the local library, a shared library connected
  and disconnected; a stroke, a shadow and a blur added and read in the Inspect tab, the code of a rectangle; a token
  the form refuses, a color token made and applied as a fill; a version saved and restored; the comments of a file, a
  comment written, the comments hidden and shown; the boards of the view mode, its zoom, comments, inspect and an
  image exported, a share link a visitor uses until it is destroyed; the PDF export of the boards (all, some, none),
  no PDF export on a page without boards, the file downloaded in its own format; the submenus of the profile, the
  release notes, the settings and the keyboard shortcuts;
- `tests/must-fail/` (23 scenarios): an assertion that is not true for a step of each kind that can fail, which must
  fail with its message and a hint.

Not tested: languages other than English (the steps read the site's words: "Continue", "Add page", "Delete file"),
canvas pixels (what is drawn is read in the layers, the Design and Inspect tabs, the size under a selection and the
files exported, never in the canvas), the WebGL renderer (beta, off by default), drags that move or resize shapes on
the canvas, prototyping and its interactions, the clipboard (copy, cut, paste), the text editor beyond a text written
(the caret, its selections, styles of a part), typographies and custom fonts, the colour picker and gradients,
advanced tokens (sets, themes, references), layouts (flex and grid), the shortcuts customised (they change the
account's own), webhooks and access tokens, plugins, the services of Penpot's own cloud (its plans and seats), and
the completion of a registration and of the onboarding's questionnaire (an account the suite makes, answers it sends:
both stay on the site for good). Team settings, roles and an account's onboarding are changed only to be changed back
in the same scenario.

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A Penpot 2 site in English, its accounts for the suite in a team of their own, and a mail catcher for the mail steps

## Install

```bash
npm install --save-dev @webship-js/penpot-steps
```

## The test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh) builds the site the suite of this repository
runs against:

- [Penpot](https://penpot.app) (MPL-2.0), the open-source edition, self-hosted from the publisher's images
  (`PENPOT_VERSION`: 2.19.4 by default): its frontend, its backend and its exporter, with PostgreSQL 15 and Valkey 8.1,
  as services of a generic DDEV project ([`site/docker-compose.penpot.yaml`](site/docker-compose.penpot.yaml)); the
  frontend takes the project's address, DDEV's own web container keeps the mail catcher (Mailpit), which takes the
  site's mail over SMTP;
- the settings of a test site: logins with a password, registration open (its refusals are tested), the verification
  of a new address off, no telemetry, the admin console (which needs a service of its own) off, a password recovery
  sent again after one second (the site waits fifteen minutes by default after a profile changed);
- the accounts of [Test users](#test-users), made with the backend's own tool (its prepl, which `manage.py` talks to),
  each having seen the onboarding and the release notes of this version, each but `admin` having answered the
  questionnaire of a new account (a scenario walks `admin`'s without sending it: answers once sent stay for good);
- through Penpot's own API, as the accounts: the team "Design team" with the four accounts in their roles; the projects
  "Website redesign" (pinned: the files "Homepage", with the boards "Hero" (a component, with its "Button") and
  "Footer", imported from [`site/homepage.penpot`](site/homepage.penpot), and "Pricing page") and "Brand" (the file
  "Style guide", a shared library with the component "Logo", imported from
  [`site/style-guide.penpot`](site/style-guide.penpot)); the team's draft "Sketches"; the editor's comment on the board
  "Hero" of "Homepage", "Can the hero be taller?".

Run again with `ACCOUNTS_ONLY=1` and the same `SITE_DIR`, the build script puts the accounts back as they were made; with
`TIDY_ONLY=1` it removes what a run that was stopped half way left (projects, files and teams named "Webship test …",
the files in the trash, invitations to "webship-test-…" addresses, comments that say "Webship test") and puts the roles
of the members and the onboarding of the accounts back.

## How the steps find things and wait

- **By what a person reads, and the site's own names for its parts.** A project by its heading, a file by its card, a
  layer by its row in the layer tree, a value of the Design tab by its name ("Width", "X axis"), a panel of the Inspect
  tab by its title, a token by its name, a menu's item by its words, a dialog's button by its words; an account by a
  handle of the users registry. What the site names for its own tests is the fallback: `layer-tree`, `layer-row`,
  `viewport`, `right-sidebar`, `dashboard-sidebar`, `project-options`, `deleted-tab`, `pinned-projects`,
  `team-options-button`, `libraries-modal`, `token-update-create-modal`, `active-users-list`, `penpot-logo-link`.
- **The app's own signals, no fixed sleeps.** A screen is an address of one page (`/?screen=dashboard-recent&team-id=…`):
  a step waits for what the screen draws once its data came (the heading, a card, a layer's row, a value) and for the
  app's loader to go. A drawing waits for its new layer; a rename for the new name; a restore for the layers it brings
  back, the folded parents of the layer tree opened on each look.
- **Messages are recorded as they come.** The site's messages ("Your file has been deleted successfully") go after a
  few seconds: a script the pack adds to every page records each one, so `the site should say "…"` reads it even when
  it is gone; the errors under a form's fields are read where they are.
- **The canvas is read through what describes it.** A shape's box on the screen comes from its layer's id
  (`g#shape-<id>` in the viewport), so a step draws inside a board where the board is. A drawing starts on an empty
  part of the canvas, clear of the shapes and of the toolbar and palettes that lie over it.
- **The panel "Libraries & Templates"** of the dashboard lies over the cards at the bottom of the page until it is
  folded (the browser remembers it): a step folds it as a person does before it clicks a card.
- **Who is logged in** is what the site's API answers for the browser's session.
- **The mail** is read from the mail catcher's API (`mailUrl`, a Mailpit): only the mail that came since the scenario
  began.
- **Test content comes and goes.** A scenario names what it makes "Webship test …", starts from a site without it
  (`Given there is no project "…"`, `Given there is a new file "…" in the project "…"`) and takes it away. Those Given
  steps work through the site's API as the managing account (`manager`) in a browser context of their own: the
  scenario's page and its session stay as they are. A deleted file stays in the site's trash for a week: they empty
  it of what they remove. What a scenario changes on an account (a role, the onboarding) goes back after it, whatever
  its outcome.
- **A cut connection is opened again.** A shared machine's network changes when a container starts: a page that was
  cut is opened again for up to 30 seconds.
- **Failures say what was found.** `The layers do not list "Ellipse". They are "Board", "Rectangle".`,
  `The design value "Width" is "300", not "301".`, `The menu does not offer "Delete". It offers "Rename", "Duplicate".`,
  with a hint on where to look.

## Accounts

The suite never creates or deletes an account. Accounts are configuration: list the ones the site has in
`worldParameters.users`, by a handle the scenarios use, each with its `email` and `password`, and its `name` for the
steps that read a person's name. An account that logged in once keeps its session for the rest of the run
(`reuseSessions: false` turns it off); a logout ends it.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists them in `worldParameters.users` (the
default values; the `<HANDLE>_PASSWORD` variables replace them). The build script makes them; the Workspace's Penpot
plugin makes the same four.

```json
{
  "owner": { "email": "owner@example.com", "password": "dD.123123ddd", "name": "Owner Test" },
  "admin": { "email": "admin@example.com", "password": "dD.123123ddd", "name": "Admin Test" },
  "editor": { "email": "editor@example.com", "password": "dD.123123ddd", "name": "Editor Test" },
  "viewer": { "email": "viewer@example.com", "password": "dD.123123ddd", "name": "Viewer Test" }
}
```

`owner` owns the team "Design team": everything of the team, its members and its settings. `admin` is an admin of it:
the projects and the files, the members and their invitations. `editor` is an editor: the projects and the files, not
the members. `viewer` is a viewer: reads the files, comments on them and inspects them; changes nothing. They are
accounts of a throwaway test site, with a placeholder password, not accounts of any real one.

## Steps

### `penpot-session.steps.js` (21)

- `Given I am a logged in user with the "owner" user`
- `When I log in as "editor" with the login form`
- `When I log in with the email "editor@example.com" and the password "Wrong-password-1"`
- `Then the login should be refused with "Email or password is incorrect."`
- `Given I am not logged in`
- `When I log out`
- `Then I should be logged in as "editor"`
- `Then I should be logged in`
- `Then I should be on the login page`
- `Then I should be on the registration page`
- `When I ask for a password reset link for "editor"`
- `When I set the password of "editor" on the reset page`
- `When I try to register with the name "Webship test", the email "owner@example.com" and the password "dD.123123ddd"`
- `Then the registration should be refused with "Email already used"`
- `Given "viewer" has not done the onboarding yet`
- `Then the onboarding should ask "Help us get to know you"`
- `When I choose "Personal" in the onboarding`
- `When I answer "Webship test" in the box "Other (specify)" of the onboarding`
- `When I press "Next" in the onboarding`
- `Then the button "Next" of the onboarding should be disabled`
- `Then the onboarding should be over`

### `penpot-dashboard.steps.js` (30)

- `When I open the team "Design team"`
- `When I go to "Drafts" in the dashboard`
- `Then the page heading should be "Projects"`
- `Then the dashboard should show the project "Website redesign"`
- `Then the project "Website redesign" should list the file "Homepage"`
- `When I create the project "Webship test project"`
- `When I rename the project "Webship test project" to "Webship test renamed project"`
- `When I open the options of the project "Website redesign"`
- `Then the menu should offer "Rename"`
- `When I choose "Rename" in the menu`
- `When I choose "Delete" in the options of the project "Webship test project"`
- `Then the options of the project "Website redesign" should offer "Rename"`
- `Then the site should say "Your project has been deleted successfully"`
- `Then the site should ask "Are you sure you want to delete this file?"`
- `Then the dialog should say "2 of 2 elements selected"`
- `Then the button "Export" of the dialog should be disabled`
- `When I press "Delete file" in the dialog`
- `When I close the dialog`
- `When I close the menu`
- `Then no dialog should be open`
- `When I create a file in the project "Webship test project"`
- `When I open the file "Homepage" from the dashboard`
- `When I rename the file "New File 1" to "Webship test file"`
- `When I select the files "Homepage" and "Pricing page"`
- `When I right-click the selected file "Homepage"`
- `When I search the dashboard for "Homepage"`
- `Then the page should list the file "Homepage"`
- `Then the trash should list the file "Webship test file"`
- `Then the pinned projects should list "Website redesign"`
- `Then the page should offer the button "+ New project"`

### `penpot-team.steps.js` (13)

- `When I create the team "Webship test team"`
- `Then the team switch should list "Design team"`
- `When I choose "Delete team" in the team options`
- `Then the team options should offer "Delete team"`
- `Then the member "editor" should have the role "Editor"`
- `Then the role of the member "owner" should not be changeable`
- `When I change the role of the member "viewer" to "Editor"`
- `When I invite "webship-test-invite@example.com" to the team as "Viewer"`
- `When I start an invitation to "editor"`
- `When I add "webship-test-invite@example.com" to the invitation`
- `Then the invitations should list "webship-test-invite@example.com" as "Pending"`
- `When I select the invitation to "webship-test-invite@example.com"`
- `When I delete the invitation to "webship-test-invite@example.com"`

### `penpot-workspace.steps.js` (36)

- `When I open the file "Homepage"`
- `When I open the file "Homepage" at a page that does not exist`
- `Then the open page should be "Page 1"`
- `Then the pages should list "Page 1"`
- `When I add a page`
- `When I open the page "Page 1"`
- `When I rename the page "Page 2" to "Webship test page"`
- `When I draw a "Board" on the canvas`
- `When I draw a "Rectangle" in the board "Board"`
- `When I write the text "Webship test text" on the canvas`
- `When I draw a path on the canvas`
- `Then the layers should list "Board"`
- `Then the layer "Board" should be selected`
- `When I select the layer "Board"`
- `When I rename the layer "Board" to "Webship test board"`
- `When I delete the layer "Ellipse"`
- `When I group the selection`
- `When I make the selection a component`
- `Then the layer "Rectangle" should be a component`
- `When I undo the last change`
- `Then the design value "Width" should be "300"`
- `When I set the design value "Width" to "300"`
- `Then the selection should measure "300 x 200"`
- `When I add a "stroke" to the selection`
- `Then the main menu "File" should offer "Add as Shared Library"`
- `When I choose "Export boards as PDF" in the main menu "File"`
- `Then the workspace should show the drawing tools`
- `When I open the "Inspect" tab`
- `Then the side panel should offer the tab "Design"`
- `Then the assets should list the component "Rectangle"`
- `Then the assets should show "Local library"`
- `When I connect the library "Style guide"`
- `When I disconnect the library "Style guide"`
- `Given "editor" has the file "Homepage" open`
- `When "editor" closes the file`
- `Then the file should show "editor" among its users`

### `penpot-history-export.steps.js` (8)

- `When I save a version named "Webship test version"`
- `Then the history should list the version "Webship test version"`
- `When I restore the version "Webship test version"`
- `When I press "Export" in the dialog to download a file`
- `When I press the button "Export 1 element" to download a file`
- `When I download the open file`
- `Then the downloaded file should be a PDF of 1 page`
- `Then the downloaded file should be a PNG image of 300 by 200 pixels`

### `penpot-comments-inspect-tokens.steps.js` (13)

- `When I add the comment "Webship test comment" on the board "Footer"`
- `Then the comments should list "Can the hero be taller?"`
- `When I close the comments panel`
- `Then the page should show 1 comment bubble`
- `Then the inspect panel "Size and position" should show "Width" as "300px"`
- `When I switch the inspect panel to "Code"`
- `Then the inspect code should contain "width: 120px;"`
- `When I create a "Color" token "webship.test.red" with the value "#ff0000"`
- `When I try to create a "Color" token "webship.test.red" with the value "1"`
- `Then the tokens should list "webship.test.red"`
- `When I apply the token "webship.test.red" to the selection as "Fill"`
- `Then the token "webship.test.red" should be applied to the "Fill"`
- `Then the token set "Global" should be active`

### `penpot-viewer.steps.js` (11)

- `When I open the view mode`
- `Then the view mode should show the board "Footer"`
- `Then the view mode should show the board 1 of 2`
- `When I go to the next board`
- `When I set the zoom of the view mode to "Fit"`
- `When I open the "Comments" section of the view mode`
- `When I add an export in the view mode`
- `When I create a share link`
- `When I destroy the share link`
- `Then a visitor should see the file "Homepage" with the share link`
- `When I go back to the dashboard from the view mode`

### `penpot-account.steps.js` (10)

- `When I open the profile menu`
- `When I point at "Help & Learning" in the profile menu`
- `When I choose "Your account" in the profile menu`
- `Then the profile menu should offer "Help Center"`
- `Then the release notes should show "Version 2.19"`
- `When I read the release notes to the end`
- `When I go to "Settings" in my account`
- `Then the setting "UI theme" should be "Penpot Dark (default)"`
- `When I search the shortcuts for "Rectangle"`
- `Then the shortcuts should list "Rectangle"`

### `penpot-mail.steps.js` (3)

- `Then an email with the subject "Password reset" should have been sent to "editor"`
- `Then the email with the subject "Password reset" to "editor" should say "We received a request to reset your password"`
- `When I open the link of the email with the subject "Password reset" to "editor"`

### `penpot-content.steps.js` (7)

- `Given there is no project "Webship test project"`
- `Given there is a project "Webship test project"`
- `Given there is no file "Webship test file"`
- `Given there is a new file "Webship test file" in the project "Webship test project"`
- `Given there is no team "Webship test team"`
- `Given there is no invitation to "webship-test-invite@example.com"`
- `Given there is no comment that says "Webship test comment" on the file "Homepage"`
Text, links, buttons, addresses and downloads are webship-js's own steps (`I should see "…"`, `I follow "…"`,
`I go to "…"`, `current url should have the "zoom" parameter with the "fit" value`,
`the downloaded file name should be "…"`, `the downloaded file should be a zip archive containing the following files
named:`); this pack adds what the site decides. Some steps take more than their first example shows:
`the dashboard should not show the project "…"`, `the menu should not offer "…"`,
`I right-click the project "…"`, `I add the layer "…" to the selection`, `the layer "…" should be a variant`,
`I write the text "…" on the canvas`, `I go to the previous board`, `the token "…" should be applied to the "Stroke"`,
`there is no project "…" in the team "…"`, `I should be on the login page saying "…"`; the JSDoc of each step lists
five.

## Phrases shared with other packs

The session phrases are the ones every platform pack has, so a feature reads the same on every system (one
`cucumber.js` profile per system; the platform packs are not meant to be loaded together). Loaded beside each of the
42 packs published so far, these phrases of this pack also match one of theirs:

| Phrase of this pack | Also in |
| --- | --- |
| `I am a logged in user with the "…" user` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, joomla, keycloak, laravel, mautic, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I log out` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mautic, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I should be logged in` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mautic, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I should be logged in as "…"` | aspnet-core, backdrop-cms, codeigniter, discourse, django, keycloak, laravel, mautic, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail |
| `I am not logged in` | aspnet-core, discourse, django, django-cms, drupal-core, joomla, keycloak, mautic, nextcloud, odoo, payload, phpbb, spring-boot, strapi, typo3, wagtail, wordpress |
| `I log in as "…" with the login form` | aspnet-core, codeigniter, discourse, django, keycloak, laravel, mautic, mediawiki, moodle, nextcloud, nextjs, payload, phpbb, spring-boot, strapi, symfony, wagtail |
| `the login should be refused with "…"` | aspnet-core, discourse, django, keycloak, mautic, mediawiki, nextcloud, payload, phpbb, spring-boot, strapi, wagtail |
| `I should be on the login page` | aspnet-core, discourse, keycloak, mautic, nextcloud, phpbb, spring-boot, wagtail, wordpress |
| `I ask for a password reset link for "…"` | aspnet-core, keycloak, laravel, mautic, nextcloud, phpbb, wagtail |
| `I log in with the email "…" and the password "…"` | aspnet-core, codeigniter, laravel, nextjs, payload, strapi |
| `I open the "…" tab` | filament, joomla, keycloak, mautic, odoo, payload |
| `I open the link of the email with the subject "…" to "…"` | mautic, phpbb, wagtail |
| `I press "…" in the dialog` | backdrop-cms, mautic, typo3 |
| `I set the password of "…" on the reset page` | mautic, phpbb, wagtail |
| `the page heading should be "…"` | backdrop-cms, filament, mautic |
| `I close the dialog` | backdrop-cms, odoo |
| `the setting "…" should be "…"` | moodle, phpbb |
| `I log in with the email address "…" and the password "…"` | symfony |
| `I open the file "…"` | nextcloud |
| `I open the page "…"` | mediawiki |
| `no dialog should be open` | mautic |
| `the registration should be refused with "…"` | phpbb |
| `the site should ask "…"` | mautic |
| `the site should say "…"` | mautic |

None matches a webship-js step, and none matches a phrase of the component pack (Bootstrap), of the Diffy pack or of
the Shopify pack, which can be loaded beside this one.

## Penpot's own tests and this pack

Penpot tests its frontend with Playwright (`frontend/playwright/` of [penpot/penpot](https://github.com/penpot/penpot),
66 spec files at 2.19.4). Most of its specs answer the app's API calls with recorded data; the steps of this pack do
the same flows on a real site and check what the site did. No code of that suite is in this pack (it is MPL-2.0; this
pack is written anew, MIT): its flows, its checks and the names the app gives its parts for testing (`layer-tree`,
`project-options`, …) guided the steps.

| Penpot's spec | In this pack |
| --- | --- |
| `login`, `example` | `session.feature`: a visitor sent to the login page, the link to the registration, a login and a logout, a malformed address, a wrong password, an address without an account |
| `legacy-hash-redirect` | `session.feature`: the old addresses of the login and recovery pages, an unknown one |
| `register` | `registration.feature`: an address already used, a malformed one, a short password, the link of an invitation given another address |
| `onboarding` | `onboarding.feature`: the questionnaire walked step by step, each step waiting for its answers (not sent: answers stay on an account for good), the choice of a team |
| `email-verification` | `account.feature`: the theme of an account, "Penpot Dark (default)"; not the verification of a new address (a suite makes no account) |
| `dashboard` | `dashboard.feature`, `projects.feature`, `files.feature`, `team.feature`: the heading, a project made, the drafts and their files, a file's menu, two files' menu, "Add custom font", the owner's role that never changes, a deleted team gone from the switch; not the banner "Team up!" kept closed (the browser keeps it) |
| `dashboard-deleted` | `files.feature`: the trash lists a deleted file |
| `dashboard-invite-members` | `team.feature`: the invitation's dialog, an address invited and its mail, the warning for a member's address, "Send invitation" disabled while only members are listed |
| `dashboard-libraries` | `dashboard.feature`: the options of a shared library |
| `dashboard-teams` | `team.feature`: "1 invitation selected" |
| `dashboard-viewer-role` | `access.feature`: no "+ New project", no Rename or Delete on a file, no "Add custom font", no team management |
| `project-menu` | `dashboard.feature`, `projects.feature`: the options by "…" and by a right click, the drafts' fewer options, rename, delete and its question, "Move to" and the other teams |
| `profile-menu` | `account.feature`: the submenus of Help & Learning and About, the release notes of the version; not the pointer's path between submenus, nor the outside pages they open |
| `workspace` | `workspace.feature`: a new file on "Page 1", a page id the file does not have, a second person in the file (a second account, live), each tool, the size under a selection, a group, the main menu's entries; not canvas pixels, the clipboard, scrollbars, grid layouts |
| `toolbar` | `workspace.feature`: a board, a rectangle, an ellipse (from the rectangle's flyout), a text, a path |
| `rename-page` | `workspace.feature`: a page added, renamed, opened; not the separator "---" |
| `layers-tab` | not: the height of the layers panel in pixels |
| `components` | `components.feature`: a component made, listed in the assets; not a copy following its main through a rotation |
| `variants` | `components.feature`: a component made the container of two variants; not variants copied, cut, pasted or dragged |
| `assets-tab`, `workspace-shared-library` | `components.feature`: the groups of the local library, a shared library connected (its component listed) and disconnected; not the colour palette, nor the updates of a library |
| `design-tab`, `multiseleccion`, `numeric-input` | `workspace.feature`, `design-and-inspect.feature`: Width, Height and Rotation set, "Mixed" for two layers, a stroke, a shadow and a blur added; not the limits of fills, constraints, layout paddings, whitespace or scrubbing in the inputs |
| `inspect-tab` | `design-and-inspect.feature`, `tokens.feature`: Size and position, Fill, Stroke, Shadow, Blur, a token in Fill, the code; not copies to the clipboard, layouts, typographies |
| `inspect-layout` | not: the grid layout's editor |
| `export-frames` | `export.feature`: the boards of the dialog (all, the selected), deselected, Export disabled at none, Cancel, the PDF (its pages counted), no PDF export on a page without boards; and the file downloaded in its own format |
| `versions` | `history.feature`: a version saved, a layer deleted, the version restored; not the history's shortcut |
| `workspace-comments` | `comments.feature`: the comments listed, one written, "Hide comments" and "Show comments" of the View menu; not the bubbles grouped when zoomed out |
| `workspace-viewer-role` | `access.feature`: no toolbar, no Design tab, no "Add as Shared Library", no "Undo" |
| `viewer-header`, `viewer-content`, `viewer-comments`, `viewer-inspect-exports` | `view-mode.feature`: the next board, the zoom "Fit" in the address, the logo back to the dashboard, the comments' bubble, an export added in the inspect and its image (its size checked); and the share link a visitor uses until it is destroyed; not prototype interactions between boards |
| `viewer-rotated-board-stroke` | not: pixels of a rotated board |
| `shortcuts` | `account.feature`: the page, its search, its "Custom" tab; not shortcuts changed, imported or exported (they change the account's own) |
| `tokens/general`, `tokens/crud`, `tokens/apply`, `tokens/sets` | `tokens.feature`: the Tokens tab, a color token refused ("Invalid color value") and made, the set "Global" made and active, the token applied as a fill (Design and Inspect); not the other types, edits, references and groups |
| `tokens/themes`, `tokens/remapping`, `tokens/tree`, `tokens/libraries`, `tokens/stroke-per-side`, `tokens/text` | not: themes, renames with their references, the tree's folds, tokens of a library, a stroke per side, tokens in a text being edited |
| `text-editor-v2`, `text-editor-v3`, `text-options-missing-font`, `workspace-texts-typography-persist`, `workspace-assets-add-typography` | `workspace.feature`: a text written (a layer named by its words); not the caret, selections, the clipboard, the styles of a part of a text, typographies, missing fonts |
| `colorpicker` | not: gradients and the picker's handles |
| `stroke-to-path`, `workspace-modifers`, `sidebar-scroll` | not: the geometry of a stroke made a path, layout and snap modifiers, scroll positions |
| `render-wasm`, `render-wasm-specs/shapes`, `render-wasm-specs/texts` | not: the WebGL renderer (beta, off by default) and its pixels |
| `subscriptions-dashboard`, `subscriptions-profile`, `subscriptions-workspace` | not: the plans of Penpot's own cloud; this pack tests the open-source edition, self-hosted |
| `visual-specs/` (dashboard, login, viewer, workspace) | not as screenshots: their screens are checked by what they show (headings, lists, panels, menus) |

## Testing this package

```bash
npm ci
npm run test:examples    # every step's JSDoc examples match it and nothing else; every feature step resolves
npm run test:paths       # a feature named on the command line runs alone
npx cucumber-js --dry-run
SITE_DIR="$PWD/../penpot-site" .github/scripts/build-ddev-site.sh
npx cucumber-js          # the whole suite
npx cucumber-js          # again: it leaves the site as it found it
npm run test:must-fail   # the assertions that must fail, each with its message and a hint
```

## How the steps were written

Every step was written from a round of manual testing of the real local site in the browser first: each screen it
touches was opened as the account the step works as, its words, roles and test names noted, and the signal it gives
while it works found. Then Penpot's own Playwright suite was read, spec by spec, and its flows that a real site can
show were walked in the browser too. The failures of the first runs went back to the browser before the step changed:
a panel of templates that lies over the bottom of the dashboard and takes the clicks meant for the cards below it, a
click after a closed menu that selects nothing, a drawing started under the toolbar that lies over the canvas, a path
tool whose button leaves the toolbar once chosen, the layers of a parent folded again after a version is restored,
Escape on the canvas dropping the selection the next step needed, the questionnaire of a new account that comes once
in an account's life (its answers cannot be taken back), a recovery link the site does not send again within fifteen
minutes of a change of the profile, and a project deleted that stays in the site's answers for a week.

## License

MIT, see [LICENSE](LICENSE).

## Logo

The logo in this README is the Penpot logo from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists
for the brand. The Penpot name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by
them.
