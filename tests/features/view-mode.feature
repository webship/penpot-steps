@view-mode
Feature: The view mode and its share link
  As a member of a team
  I want to go through the boards of a file as they will be seen, inspect them, and share them with a link
  So that people review a design without the tools to change it

  Background:
    Given I am a logged in user with the "owner" user
    And I open the file "Homepage"
    And I open the view mode

  Scenario: The boards one after another, the zoom, the comments and the inspect
    Then the view mode should show the board "Footer"
    And the view mode should show the board 1 of 2
    When I go to the next board
    Then the view mode should show the board "Hero"
    And the view mode should show the board 2 of 2
    And current url should have the "index" parameter with the "1" value
    When I set the zoom of the view mode to "Fit"
    Then current url should have the "zoom" parameter with the "fit" value
    When I open the "Comments" section of the view mode
    Then the page should show 1 comment bubble
    When I open the "Inspect" section of the view mode
    Then the inspect panel "Size and position" should show "Width" as "300px"
    When I add an export in the view mode
    And I press the button "Export 1 element" to download a file
    Then the downloaded file name should be "Hero.png"
    And the downloaded file should be a PNG image of 300 by 200 pixels
    When I go back to the dashboard from the view mode
    Then the page heading should be "Projects"

  Scenario: A share link opens the view mode for a visitor until it is destroyed
    When I create a share link
    Then a visitor should see the file "Homepage" with the share link
    When I destroy the share link
    Then a visitor should not see the file "Homepage" with the share link
