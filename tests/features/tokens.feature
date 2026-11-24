@workspace @tokens
Feature: Design tokens
  As a designer of a team
  I want to keep colours as named tokens and apply them to layers
  So that a change of a token changes every layer that uses it

  Background:
    Given there is a new file "Webship test file" in the project "Webship test project"
    And I am a logged in user with the "editor" user
    And I open the file "Webship test file"

  Scenario: A token with a value the form refuses is not saved
    When I try to create a "Color" token "webship.test.red" with the value "1"
    Then the dialog should say "Invalid color value: 1"
    And the button "Save" of the dialog should be disabled
    When I close the dialog
    Then the tokens should not list "webship.test.red"

  Scenario: A color token made and applied to a rectangle as its fill
    When I draw a "Board" on the canvas
    And I draw a "Rectangle" in the board "Board"
    And I create a "Color" token "webship.test.red" with the value "#ff0000"
    Then the tokens should list "webship.test.red"
    And the token set "Global" should be active
    When I select the layer "Rectangle"
    And I apply the token "webship.test.red" to the selection as "Fill"
    Then the token "webship.test.red" should be applied to the "Fill"
    When I open the "Inspect" tab
    Then the inspect panel "Fill" should show "Background" as "webship.test.red"
