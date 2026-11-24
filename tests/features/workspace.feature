@workspace
Feature: The workspace
  As a designer of a team
  I want to draw boards and shapes, write texts, name and group layers, and set their values
  So that a design takes shape

  Background:
    Given there is a new file "Webship test file" in the project "Webship test project"
    And I am a logged in user with the "editor" user
    And I open the file "Webship test file"

  Scenario: A new file opens on its first page; an address with a page that is not there opens it too
    Then the open page should be "Page 1"
    And the pages should list "Page 1"
    When I open the file "Webship test file" at a page that does not exist
    Then the open page should be "Page 1"

  Scenario: Each tool of the toolbar makes its layer
    When I draw a "Board" on the canvas
    Then the layer "Board" should be selected
    When I draw a "Rectangle" in the board "Board"
    And I draw an "Ellipse" in the board "Board"
    And I write the text "Webship test text" in the board "Board"
    And I draw a path on the canvas
    Then the layers should list "Board"
    And the layers should list "Rectangle"
    And the layers should list "Ellipse"
    And the layers should list "Webship test text"
    And the layers should list "Path"
    And the workspace should show the drawing tools

  Scenario: The values of a selection, one layer or several
    When I draw a "Board" on the canvas
    And I set the design value "Width" to "300"
    And I set the design value "Height" to "200"
    Then the design value "Width" should be "300"
    And the selection should measure "300 x 200"
    When I draw a "Rectangle" in the board "Board"
    And I set the design value "Width" to "120"
    And I set the design value "Rotation" to "45"
    Then the design value "Rotation" should be "45"
    When I draw an "Ellipse" in the board "Board"
    And I set the design value "Width" to "60"
    And I select the layer "Rectangle"
    And I add the layer "Ellipse" to the selection
    Then the design value "Width" should be "Mixed"

  Scenario: Layers renamed, grouped, deleted, and a change undone
    When I draw a "Board" on the canvas
    And I draw a "Rectangle" in the board "Board"
    And I draw an "Ellipse" in the board "Board"
    And I rename the layer "Board" to "Webship test board"
    Then the layers should list "Webship test board"
    And the layers should not list "Board"
    When I select the layer "Rectangle"
    And I add the layer "Ellipse" to the selection
    And I group the selection
    Then the layer "Group" should be selected
    When I undo the last change
    Then the layers should not list "Group"
    When I delete the layer "Ellipse"
    Then the layers should not list "Ellipse"
    And the layers should list "Rectangle"

  Scenario: Pages added, opened and renamed
    When I add a page
    Then the open page should be "Page 2"
    When I rename the page "Page 2" to "Webship test page"
    Then the pages should list "Webship test page"
    And the pages should not list "Page 2"
    When I open the page "Page 1"
    Then the open page should be "Page 1"

  Scenario: The main menu of an editor
    Then the main menu "File" should offer "Add as Shared Library"
    And the main menu "File" should offer "Download Penpot file (.penpot)"
    And the main menu "Edit" should offer "Undo"
    And the main menu "Edit" should offer "Redo"
    And the main menu "View" should offer "Hide comments"

  Scenario: Another person opens the same file, and leaves it
    Given "owner" has the file "Webship test file" open
    Then the file should show "owner" among its users
    And the file should show "editor" among its users
    When "owner" closes the file
    Then the file should not show "owner" among its users
