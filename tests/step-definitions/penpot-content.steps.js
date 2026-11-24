'use strict';

// What a scenario needs on the site before it starts, prepared through the
// site's own API as the managing account (manager in cucumber.js), never in
// the scenario's browser: a project or a file there or not, a team, an
// invitation or a comment not there. A suite names its own content
// "Webship test …" and invites only "webship-test-…" addresses, so the build's
// tidy (TIDY_ONLY=1) can remove what a stopped run left.

const { Given } = require('@cucumber/cucumber');
const h = require('./penpot-helpers');

/** The team a step names (or the scenario's team), as the managing account sees it. */
async function team(world, call, name) {
  return h.managedTeam(world, call, name);
}

/**
 * Make sure a team has no project of a name (with its files): deleted, and its files taken out of the trash for good.
 *
 * Example #1: Given there is no project "Webship test project"
 * Example #2: Given there is no project "Webship test renamed project" in the team "Design team"
 * Example #3: And there is no project "Webship test brand"
 * Example #4: Given there is no project "Webship test project" in the team "Design team"
 * Example #5: Given there is no project "Webship test 2"
 */
Given(/^there is no project "([^"]*)"(?: in the team "([^"]*)")?$/, { timeout: 120000 }, async function (name, teamName) {
  await h.withApi(this, h.managerHandle(this), async (call) => {
    const t = await team(this, call, teamName);
    // Deleted projects stay in the answer for a week: their files are in the trash, which is emptied of them too.
    const named = (await call('get-projects', { teamId: t.id })).filter((p) => !p.isDefault && h.normal(p.name) === h.normal(name));
    for (const p of named.filter((x) => !x.deletedAt)) await call('delete-project', { id: p.id });
    if (named.length) await h.purgeTrash(call, t.id, (d) => named.some((p) => p.id === d.projectId));
  });
});

/**
 * Make sure a team has a project of a name (made when it is not there).
 *
 * Example #1: Given there is a project "Webship test project"
 * Example #2: Given there is a project "Webship test project" in the team "Design team"
 * Example #3: And there is a project "Webship test brand"
 * Example #4: Given there is a project "Webship test project"
 * Example #5: Given there is a project "Webship test second project" in the team "Design team"
 */
Given(/^there is a project "([^"]*)"(?: in the team "([^"]*)")?$/, { timeout: 120000 }, async function (name, teamName) {
  await h.withApi(this, h.managerHandle(this), async (call) => {
    const t = await team(this, call, teamName);
    if (!(await h.findProject(call, t.id, name))) await call('create-project', { teamId: t.id, name });
  });
});

/**
 * Make sure a team has no file of a name, in any of its projects: deleted, and taken out of the trash for good.
 *
 * Example #1: Given there is no file "Webship test file"
 * Example #2: Given there is no file "Webship test renamed file" in the team "Design team"
 * Example #3: And there is no file "New File 1"
 * Example #4: Given there is no file "Webship test second file"
 * Example #5: Given there is no file "Webship test file" in the team "Design team"
 */
Given(/^there is no file "([^"]*)"(?: in the team "([^"]*)")?$/, { timeout: 120000 }, async function (name, teamName) {
  await h.withApi(this, h.managerHandle(this), async (call) => {
    const t = await team(this, call, teamName);
    const doomed = (await h.teamFiles(call, t.id)).filter((f) => h.normal(f.name) === h.normal(name));
    for (const f of doomed) await call('delete-file', { id: f.id });
    await h.purgeTrash(call, t.id, (d) => h.normal(d.name) === h.normal(name));
  });
});

/**
 * Make sure a project of the scenario's team holds a new, empty file of a name: one of that name there before is
 * deleted first, so the scenario starts from a blank file. The project is made when it is not there. After the
 * scenario, whatever its outcome, the file goes, and the project too when this step made it and it holds no other
 * file.
 *
 * Example #1: Given there is a new file "Webship test file" in the project "Webship test project"
 * Example #2: Given there is a new file "Webship test second file" in the project "Webship test project"
 * Example #3: And there is a new file "Webship test file" in the project "Webship test project"
 * Example #4: Given there is a new file "Webship test library" in the project "Webship test project"
 * Example #5: Given there is a new file "Webship test file" in the project "Drafts"
 */
Given(/^there is a new file "([^"]*)" in the project "([^"]*)"$/, { timeout: 120000 }, async function (name, projectName) {
  await h.withApi(this, h.managerHandle(this), async (call) => {
    const t = await team(this, call);
    const old = (await h.teamFiles(call, t.id)).filter((f) => h.normal(f.name) === h.normal(name));
    for (const f of old) await call('delete-file', { id: f.id });
    await h.purgeTrash(call, t.id, (d) => h.normal(d.name) === h.normal(name));
    let project = await h.findProject(call, t.id, projectName);
    const made = !project;
    if (!project) project = await call('create-project', { teamId: t.id, name: projectName });
    await call('create-file', { projectId: project.id, name });
    const teamId = t.id;
    const projectId = project.id;
    this.__restore.push(() => h.withApi(this, h.managerHandle(this), async (again) => {
      const files = await again('get-project-files', { projectId }).catch(() => []);
      for (const f of files.filter((x) => h.normal(x.name) === h.normal(name))) await again('delete-file', { id: f.id });
      if (made && !(await again('get-project-files', { projectId }).catch(() => [])).length) await again('delete-project', { id: projectId }).catch(() => {});
      await h.purgeTrash(again, teamId, (d) => h.normal(d.name) === h.normal(name) || (made && d.projectId === projectId));
    }));
  });
});

/**
 * Make sure no account of the users registry owns a team of a name (a team a scenario made): deleted, with its
 * projects and files.
 *
 * Example #1: Given there is no team "Webship test team"
 * Example #2: Given there is no team "Webship test agency"
 * Example #3: And there is no team "Webship test team"
 * Example #4: Given there is no team "Webship test studio"
 * Example #5: Given there is no team "Webship test team"
 */
Given(/^there is no team "([^"]*)"$/, { timeout: 180000 }, async function (name) {
  const users = Object.keys((this.parameters && this.parameters.users) || {});
  for (const handle of users) {
    await h.withApi(this, handle, async (call) => {
      for (const t of await call('get-teams')) {
        if (!t.isDefault && h.normal(t.name) === h.normal(name) && (t.isOwner || (t.permissions && t.permissions.isOwner) || t.role === 'owner')) {
          await call('delete-team', { id: t.id });
        }
      }
    }).catch(() => {});
  }
});

/**
 * Make sure a team has no invitation to an address (deleted when it is there).
 *
 * Example #1: Given there is no invitation to "webship-test-invite@example.com"
 * Example #2: Given there is no invitation to "webship-test-join@example.com" in the team "Design team"
 * Example #3: And there is no invitation to "webship-test-invite@example.com"
 * Example #4: Given there is no invitation to "webship-test-other@example.com"
 * Example #5: Given there is no invitation to "webship-test-invite@example.com" in the team "Design team"
 */
Given(/^there is no invitation to "([^"]*)"(?: in the team "([^"]*)")?$/, { timeout: 120000 }, async function (address, teamName) {
  await h.withApi(this, h.managerHandle(this), async (call) => {
    const t = await team(this, call, teamName);
    for (const inv of await call('get-team-invitations', { teamId: t.id })) {
      if (h.normal(inv.email) === h.normal(address)) await call('delete-team-invitation', { teamId: t.id, email: inv.email });
    }
  });
});

/**
 * Make sure a file has no comment thread that says a text (deleted when there is one).
 *
 * Example #1: Given there is no comment that says "Webship test comment" on the file "Homepage"
 * Example #2: Given there is no comment that says "Webship test note" on the file "Homepage"
 * Example #3: And there is no comment that says "Webship test comment" on the file "Pricing page"
 * Example #4: Given there is no comment that says "Webship test comment" on the file "Webship test file"
 * Example #5: Given there is no comment that says "Webship test" on the file "Homepage"
 */
Given(/^there is no comment that says "([^"]*)" on the file "([^"]*)"$/, { timeout: 120000 }, async function (words, fileName) {
  await h.withApi(this, h.managerHandle(this), async (call) => {
    const t = await team(this, call);
    for (const f of (await h.teamFiles(call, t.id)).filter((x) => h.normal(x.name) === h.normal(fileName))) {
      for (const thread of await call('get-comment-threads', { fileId: f.id })) {
        if (h.mentions(thread.content || '', words)) await call('delete-comment-thread', { id: thread.id });
      }
    }
  });
});
