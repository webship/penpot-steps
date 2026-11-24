'use strict';

// The mail the site sends (a password reset, an invitation to a team), read
// in the mail catcher it sends to, and the links in it.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./penpot-helpers');

/**
 * Assert that the site sent an email with a subject (or a part of it) to an account of the registry (by its handle) or
 * an address, since the scenario began.
 *
 * Example #1: Then an email with the subject "Password reset" should have been sent to "editor"
 * Example #2: Then an email with the subject "has invited you to join the team" should have been sent to "webship-test-invite@example.com"
 * Example #3: And an email with the subject "Password reset" should have been sent to "viewer"
 * Example #4: Then an email with the subject "Design team" should have been sent to "webship-test-join@example.com"
 * Example #5: Then an email with the subject "Password reset" should have been sent to "editor@example.com"
 */
Then(/^an email with the subject "([^"]*)" should have been sent to "([^"]*)"$/, { timeout: 120000 }, async function (subject, who) {
  await h.waitForMail(this, h.addressOf(this, who), subject);
});

/**
 * Assert what an email the site sent says (its text, or a part of it).
 *
 * Example #1: Then the email with the subject "Password reset" to "editor" should say "We received a request to reset your password"
 * Example #2: Then the email with the subject "has invited you" to "webship-test-invite@example.com" should say "Accept invitation using this link"
 * Example #3: And the email with the subject "Password reset" to "viewer" should say "Hello Viewer Test!"
 * Example #4: Then the email with the subject "Password reset" to "editor" should say "Hello Editor Test!"
 * Example #5: Then the email with the subject "has invited you" to "webship-test-join@example.com" should say "Design team"
 */
Then(/^the email with the subject "([^"]*)" to "([^"]*)" should say "([^"]*)"$/, { timeout: 120000 }, async function (subject, who, expected) {
  const found = await h.waitForMail(this, h.addressOf(this, who), subject);
  const message = await h.mailMessage(this, found.ID);
  const text = h.mailText(message);
  if (!h.mentions(text, expected)) {
    throw friendly({ message: `The email "${found.Subject}" does not say "${expected}". It says "${text.slice(0, 300)}".`, hint: 'The text of an email is compared as it reads, white space aside.' });
  }
});

/**
 * Open the link of an email the site sent (the first link to the site in it) in the scenario's browser: a password
 * reset's link opens its page, an invitation's link its registration form.
 *
 * Example #1: When I open the link of the email with the subject "Password reset" to "editor"
 * Example #2: When I open the link of the email with the subject "has invited you" to "webship-test-invite@example.com"
 * Example #3: And I open the link of the email with the subject "Password reset" to "viewer"
 * Example #4: When we open the link of the email with the subject "Password reset" to "editor"
 * Example #5: When I open the link of the email with the subject "Design team" to "webship-test-join@example.com"
 */
When(/^(?:I|we) open the link of the email with the subject "([^"]*)" to "([^"]*)"$/, { timeout: 120000 }, async function (subject, who) {
  const found = await h.waitForMail(this, h.addressOf(this, who), subject);
  const message = await h.mailMessage(this, found.ID);
  const root = h.siteRoot(this);
  const link = h.mailLinks(message).find((u) => u.startsWith(root) && /token=/.test(u)) || h.mailLinks(message).find((u) => u.startsWith(root));
  if (!link) {
    throw friendly({ message: `The email "${found.Subject}" has no link to the site (${root}).`, hint: 'The site writes its links with its public address: the build sets it to the address of the site.' });
  }
  await h.open(this, link);
});
