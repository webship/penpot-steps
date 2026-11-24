@workspace @comments
Feature: Comments on a file
  As a member of a team
  I want to read and write comments on the boards of a file, and hide them while I work
  So that a design is discussed where it is drawn

  Background:
    Given there is no comment that says "Webship test comment" on the file "Homepage"
    And I am a logged in user with the "owner" user
    And I open the file "Homepage"

  Scenario: The comment of a member is listed, on its bubble
    Then the comments should list "Can the hero be taller?"
    And the page should show 1 comment bubble

  Scenario: A comment written on a board, then the comments hidden and shown
    When I add the comment "Webship test comment" on the board "Footer"
    Then the comments should list "Webship test comment"
    And the page should show 2 comment bubbles
    When I close the comments panel
    Then the page should show 2 comment bubbles
    When I choose "Hide comments" in the main menu "View"
    Then the page should show 0 comment bubbles
    When I choose "Show comments" in the main menu "View"
    Then the page should show 2 comment bubbles
    And there is no comment that says "Webship test comment" on the file "Homepage"
