@dashboard @projects
Feature: Projects
  As an editor of a team
  I want to make, rename, pin and delete projects
  So that the team's files stay in order

  Background:
    Given there is no project "Webship test project"
    And there is no project "Webship test renamed project"
    And I am a logged in user with the "editor" user
    And I open the team "Design team"

  Scenario: A project is made, renamed, pinned and deleted
    When I create the project "Webship test project"
    Then the dashboard should show the project "Webship test project"
    When I rename the project "Webship test project" to "Webship test renamed project"
    Then the dashboard should show the project "Webship test renamed project"
    And the dashboard should not show the project "Webship test project"
    When I choose "Pin/Unpin" in the options of the project "Webship test renamed project"
    Then the pinned projects should list "Webship test renamed project"
    When I choose "Delete" in the options of the project "Webship test renamed project"
    Then the site should ask "Are you sure you want to delete this project?"
    When I press "Delete project" in the dialog
    Then the site should say "Your project has been deleted successfully"
    And the dashboard should not show the project "Webship test renamed project"
    And the pinned projects should not list "Webship test renamed project"
    And there is no project "Webship test renamed project"
