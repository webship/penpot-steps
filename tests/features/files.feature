@dashboard @files
Feature: Files
  As an editor of a team
  I want to make a file, name it, open it and delete it
  So that the team's projects hold the files they need

  Background:
    Given there is no file "New File 1"
    And there is no file "Webship test file"
    And there is a project "Webship test project"
    And I am a logged in user with the "editor" user
    And I open the team "Design team"

  Scenario: A file is made, renamed in the workspace, opened from the dashboard and deleted to the trash
    When I create a file in the project "Webship test project"
    Then the open page should be "Page 1"
    When I rename the file "New File 1" to "Webship test file"
    And I open the team "Design team"
    Then the project "Webship test project" should list the file "Webship test file"
    When I open the file "Webship test file" from the dashboard
    Then the pages should list "Page 1"
    When I open the team "Design team"
    And I choose "Delete" in the options of the file "Webship test file"
    Then the site should ask "Are you sure you want to delete this file?"
    When I press "Delete file" in the dialog
    Then the site should say "Your file has been deleted successfully"
    And the project "Webship test project" should not list the file "Webship test file"
    And the trash should list the file "Webship test file"
    And there is no project "Webship test project"
