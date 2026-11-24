@workspace @inspect
Feature: The Design and Inspect tabs
  As a designer and a developer of a team
  I want to add strokes, shadows and blurs, and read them as a developer does, with their code
  So that what is designed is what is built

  Background:
    Given there is a new file "Webship test file" in the project "Webship test project"
    And I am a logged in user with the "editor" user
    And I open the file "Webship test file"
    And I draw a "Board" on the canvas
    And I draw a "Rectangle" in the board "Board"
    And I set the design value "Width" to "120"
    And I set the design value "Height" to "80"

  Scenario: A stroke, a shadow and a blur added to a rectangle, read in the Inspect tab
    When I add a "stroke" to the selection
    And I add a "shadow" to the selection
    And I add a "blur" to the selection
    And I open the "Inspect" tab
    Then the inspect panel "Size and position" should show "Width" as "120px"
    And the inspect panel "Size and position" should show "Height" as "80px"
    And the inspect panel "Fill" should show "Background" as "#B1B2B5 100%"
    And the inspect panel "Stroke" should show "Border width" as "1px"
    And the inspect panel "Shadow" should show "Drop shadow" as "4px 4px 4px 0px"
    And the inspect panel "Blur" should show "Filter" as "blur(4px)"

  Scenario: The code of a rectangle
    When I open the "Inspect" tab
    And I switch the inspect panel to "Code"
    Then the inspect code should contain "width: 120px;"
    And the inspect code should contain "height: 80px;"
    And the inspect code should contain "background: #B1B2B5FF;"
    When I switch the inspect panel to "Styles"
    Then the inspect panel "Fill" should show "Background" as "#B1B2B5"
