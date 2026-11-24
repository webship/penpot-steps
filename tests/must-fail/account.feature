@must-fail
Feature: Assertions of the account that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: Another theme than the account has
    Fails with: The setting "UI theme" is "Penpot Dark (default)", not "Penpot Light".
    Given I am a logged in user with the "editor" user
    When I go to "Settings" in my account
    Then the setting "UI theme" should be "Penpot Light"

  Scenario: An item the profile menu does not have
    Fails with: The profile menu does not offer "Webship test nothing".
    Given I am a logged in user with the "editor" user
    When I open the profile menu
    Then the profile menu should offer "Webship test nothing"

  Scenario: A shortcut the search leaves out
    Fails with: The shortcuts do not list "Ellipse".
    Given I am a logged in user with the "editor" user
    When I go to "Shortcuts" in my account
    And I search the shortcuts for "Rectangle"
    Then the shortcuts should list "Ellipse"
