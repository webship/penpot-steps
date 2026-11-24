@dashboard
Feature: The dashboard
  As a member of a team
  I want the dashboard to show the team's projects, drafts, libraries and fonts, and to find files
  So that I reach the file I work on

  Background:
    Given I am a logged in user with the "owner" user
    And I open the team "Design team"

  Scenario: The projects of a team, a pinned one in the side bar
    Then the page heading should be "Projects"
    And the dashboard should show the project "Website redesign"
    And the dashboard should show the project "Brand"
    And the project "Website redesign" should list the file "Homepage"
    And the project "Brand" should list the file "Style guide"
    And the pinned projects should list "Website redesign"
    And the pinned projects should not list "Brand"

  Scenario: The sections of the side bar: drafts, libraries, fonts
    When I go to "Drafts" in the dashboard
    Then the page heading should be "Drafts"
    And the page should list the file "Sketches"
    And the page should not list the file "Homepage"
    When I go to "Libraries" in the dashboard
    Then the page heading should be "Libraries"
    And the page should list the file "Style guide"
    And the page should not list the file "Homepage"
    And the options of the file "Style guide" should offer "Unpublish Library"
    And the options of the file "Style guide" should offer "Rename"
    When I go to "Fonts" in the dashboard
    Then the page heading should be "Fonts"
    And the page should offer the button "Add custom font"

  Scenario: The search finds the files of the team
    When I search the dashboard for "Home"
    Then the page heading should be "Search results"
    And the page should list the file "Homepage"
    And the page should not list the file "Style guide"
    When I search the dashboard for "nothing like this"
    Then I should see "No matches found"

  Scenario: The menus of a file and of two files
    When I right-click the file "Homepage"
    Then the menu should offer "Rename"
    And the menu should offer "Duplicate"
    And the menu should offer "Add as Shared Library"
    And the menu should offer "Delete"
    When I close the menu
    And I select the files "Homepage" and "Pricing page"
    And I right-click the selected file "Homepage"
    Then the menu should offer "Duplicate 2 files"
    And the menu should offer "Move 2 files to"
    And the menu should offer "Delete 2 files"

  Scenario: The options of a project, the team's drafts holding fewer
    When I open the options of the project "Website redesign"
    Then the menu should offer "Rename"
    And the menu should offer "Duplicate"
    And the menu should offer "Pin/Unpin"
    And the menu should offer "Delete"
    When I close the menu
    And I right-click the project "Brand"
    Then the menu should offer "Rename"
    And the menu should offer "Delete"
    When I choose "Move to" in the menu
    Then the menu should offer "Default"
    When I close the menu
    Then the options of the project "Drafts" should not offer "Rename"
    And the options of the project "Drafts" should not offer "Delete"
