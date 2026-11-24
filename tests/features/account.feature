@account
Feature: The account
  As a person with an account
  I want the menu of my profile, the release notes, my settings and the keyboard shortcuts
  So that the platform works the way I do

  Background:
    Given I am a logged in user with the "editor" user
    And I open the team "Design team"

  Scenario: The submenus of the profile menu
    When I open the profile menu
    Then the profile menu should offer "Your account"
    When I point at "Help & Learning" in the profile menu
    Then the profile menu should offer "Help Center"
    When I point at "About" in the profile menu
    Then the profile menu should offer "Penpot Changelog"
    And the profile menu should not offer "Help Center"

  Scenario: The release notes of the version, read to their end
    When I point at "About" in the profile menu
    And I choose "Version" in the profile menu
    Then the release notes should show "What’s new in Penpot?"
    When I read the release notes to the end
    Then the page heading should be "Projects"

  Scenario: The settings of the account
    When I go to "Settings" in my account
    Then the page heading should be "Your account"
    And the setting "UI theme" should be "Penpot Dark (default)"
    And the setting "Language" should be "Auto (browser)"

  Scenario: The keyboard shortcuts, searched and customised
    When I go to "Shortcuts" in my account
    And I search the shortcuts for "Rectangle"
    Then the shortcuts should list "Rectangle"
    When I open the "Custom" tab
    Then I should see "No custom shortcuts yet"
