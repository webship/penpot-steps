@workspace @history
Feature: The history of a file
  As a designer of a team
  I want to save a version of a file and go back to it
  So that a change that went wrong can be undone at any time

  Background:
    Given there is a new file "Webship test file" in the project "Webship test project"
    And I am a logged in user with the "editor" user
    And I open the file "Webship test file"

  Scenario: A version saved, a layer deleted, the version restored
    When I draw a "Board" on the canvas
    And I draw an "Ellipse" in the board "Board"
    And I save a version named "Webship test version"
    Then the history should list the version "Webship test version"
    When I delete the layer "Ellipse"
    Then the layers should not list "Ellipse"
    When I restore the version "Webship test version"
    Then the layers should list "Ellipse"
