@access
Feature: What the role of an account lets it do
  As the owner of a team
  I want a viewer to read the team's files without changing them
  So that people who only review a design cannot break it

  Scenario: A viewer makes no project, no file and no font, and manages nobody
    Given I am a logged in user with the "viewer" user
    When I open the team "Design team"
    Then the page should not offer the button "+ New project"
    And the options of the file "Homepage" should not offer "Rename"
    And the options of the file "Homepage" should not offer "Delete"
    And the team options should offer "Leave team"
    And the team options should not offer "Invitations"
    And the team options should not offer "Delete team"
    When I go to "Fonts" in the dashboard
    Then the page should not offer the button "Add custom font"

  Scenario: A viewer reads a file and its comments without the tools to change it
    Given I am a logged in user with the "viewer" user
    When I open the file "Homepage"
    Then the workspace should not show the drawing tools
    And the side panel should not offer the tab "Design"
    And the main menu "File" should not offer "Add as Shared Library"
    And the main menu "File" should offer "Export boards as PDF"
    And the main menu "Edit" should not offer "Undo"
    And the comments should list "Can the hero be taller?"

  Scenario: An editor makes projects and draws, without managing the team
    Given I am a logged in user with the "editor" user
    When I open the team "Design team"
    Then the page should offer the button "+ New project"
    And the team options should not offer "Delete team"
    When I open the file "Homepage"
    Then the workspace should show the drawing tools
    And the side panel should offer the tab "Design"
    And the main menu "Edit" should offer "Undo"
