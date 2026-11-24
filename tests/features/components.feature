@workspace @components
Feature: Components, variants and shared libraries
  As a designer of a team
  I want to make components and variants, and use the components of the team's shared libraries
  So that a design reuses its parts

  Background:
    Given there is a new file "Webship test file" in the project "Webship test project"
    And I am a logged in user with the "editor" user
    And I open the file "Webship test file"

  Scenario: A rectangle made a component, then the container of two variants
    When I draw a "Board" on the canvas
    And I draw a "Rectangle" in the board "Board"
    And I select the layer "Rectangle"
    And I make the selection a component
    Then the layer "Rectangle" should be a component
    And the assets should list the component "Rectangle"
    When I make the selection a component
    Then the layers should list "Value 1"
    And the layer "Value 1" should be a variant
    And the layer "Value 2" should be a variant

  Scenario: The local library of a file, and a shared library connected and disconnected
    Then the assets should show "Local library"
    And the assets should show "Components"
    And the assets should show "Colors"
    And the assets should show "Typographies"
    And the assets should not show "Style guide"
    When I connect the library "Style guide"
    Then the assets should show "Style guide"
    And the assets should list the component "Logo"
    When I disconnect the library "Style guide"
    Then the assets should not show "Style guide"
