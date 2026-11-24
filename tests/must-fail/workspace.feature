@must-fail
Feature: Assertions of the workspace and the view mode that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A layer the page does not have
    Fails with: The layers do not list "Webship test nothing".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    Then the layers should list "Webship test nothing"

  Scenario: Another width than the board has
    Fails with: The design value "Width" is "300", not "301".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    And I select the layer "Hero"
    Then the design value "Width" should be "301"

  Scenario: Another size under the selection
    Fails with: The selection measures "300 x 200", not "301 x 200".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    And I select the layer "Hero"
    Then the selection should measure "301 x 200"

  Scenario: Another width in the Inspect tab
    Fails with: The inspect panel "Size and position" does not show "Width" as "301px".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    And I select the layer "Hero"
    And I open the "Inspect" tab
    Then the inspect panel "Size and position" should show "Width" as "301px"

  Scenario: A board that is not a component
    Fails with: The layer "Footer" is not a component.
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    Then the layer "Footer" should be a component

  Scenario: A comment nobody wrote
    Fails with: The comments do not list "Webship test nothing".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    Then the comments should list "Webship test nothing"

  Scenario: An entry the main menu does not have
    Fails with: The main menu "File" does not offer "Webship test nothing".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    Then the main menu "File" should offer "Webship test nothing"

  Scenario: Drawing tools for a viewer
    Fails with: The workspace does not show the drawing tools.
    Given I am a logged in user with the "viewer" user
    When I open the file "Homepage"
    Then the workspace should show the drawing tools

  Scenario: A token the file does not have
    Fails with: The tokens do not list "webship.test.nothing".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    Then the tokens should list "webship.test.nothing"

  Scenario: Another board first in the view mode
    Fails with: The view mode does not show the board "Hero".
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    And I open the view mode
    Then the view mode should show the board "Hero"
