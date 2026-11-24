@must-fail
Feature: Assertions of the session and the dashboard that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: Another account than the one logged in
    Fails with: "editor@example.com" is logged in, not "admin@example.com".
    Given I am a logged in user with the "editor" user
    Then I should be logged in as "admin"

  Scenario: A login that worked is not a refusal
    Fails with: The login was not refused
    When I log in as "viewer" with the login form
    Then the login should be refused with "Email or password is incorrect."

  Scenario: A project the team does not have
    Fails with: The dashboard does not show the project "Webship test nothing".
    Given I am a logged in user with the "owner" user
    When I open the team "Design team"
    Then the dashboard should show the project "Webship test nothing"

  Scenario: A file in another project
    Fails with: The project "Brand" does not list the file "Homepage".
    Given I am a logged in user with the "owner" user
    When I open the team "Design team"
    Then the project "Brand" should list the file "Homepage"

  Scenario: The heading of another screen
    Fails with: The page heading is "Projects", not "Drafts".
    Given I am a logged in user with the "owner" user
    When I open the team "Design team"
    Then the page heading should be "Drafts"

  Scenario: An action a menu does not have
    Fails with: The menu does not offer "Webship test nothing".
    Given I am a logged in user with the "owner" user
    When I open the team "Design team"
    And I right-click the file "Homepage"
    Then the menu should offer "Webship test nothing"

  Scenario: A button a viewer does not get
    Fails with: The page does not offer the button "+ New project"
    Given I am a logged in user with the "viewer" user
    When I open the team "Design team"
    Then the page should offer the button "+ New project"

  Scenario: Another role than the member has
    Fails with: The member "viewer" has the role "Viewer", not "Editor".
    Given I am a logged in user with the "owner" user
    When I open the team "Design team"
    Then the member "viewer" should have the role "Editor"

  Scenario: A team the account is not in
    Fails with: The team switch does not list "Webship test nothing".
    Given I am a logged in user with the "owner" user
    When I open the team "Design team"
    Then the team switch should list "Webship test nothing"

  Scenario: An email the site did not send
    Fails with: No email with the subject "Webship test nothing" came to editor@example.com
    Given I am a logged in user with the "editor" user
    Then an email with the subject "Webship test nothing" should have been sent to "editor"
