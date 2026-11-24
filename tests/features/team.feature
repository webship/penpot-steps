@team
Feature: The team, its members and its invitations
  As the owner of a team
  I want to see its members and their roles, invite people and make other teams
  So that the right people reach the right projects

  Background:
    Given I am a logged in user with the "owner" user
    And I open the team "Design team"

  Scenario: The members of the team and their roles; the owner's never changes
    When I choose "Members" in the team options
    Then the page heading should be "Members"
    And the member "owner" should have the role "Owner"
    And the member "admin" should have the role "Admin"
    And the member "editor" should have the role "Editor"
    And the member "viewer" should have the role "Viewer"
    And the role of the member "owner" should not be changeable
    And the role of the member "editor" should be changeable

  Scenario: The role of a member changes, and changes back
    When I change the role of the member "viewer" to "Editor"
    Then the member "viewer" should have the role "Editor"
    When I change the role of the member "viewer" to "Viewer"
    Then the member "viewer" should have the role "Viewer"

  @mail
  Scenario: An address is invited, its invitation selected and deleted
    Given there is no invitation to "webship-test-invite@example.com"
    When I invite "webship-test-invite@example.com" to the team as "Viewer"
    Then the site should say "Invitation sent successfully"
    And the invitations should list "webship-test-invite@example.com" as "Pending"
    And an email with the subject "has invited you to join the team" should have been sent to "webship-test-invite@example.com"
    And the email with the subject "has invited you to join the team" to "webship-test-invite@example.com" should say "Accept invitation using this link"
    When I select the invitation to "webship-test-invite@example.com"
    Then I should see "1 invitation selected"
    When I delete the invitation to "webship-test-invite@example.com"
    Then the site should say "Invitation deleted successfully"
    And the invitations should not list "webship-test-invite@example.com"

  Scenario: An address of a member is not invited again
    When I start an invitation to "editor"
    Then the dialog should say "Some members are already on the team. We'll invite the rest."
    And the button "Send invitation" of the dialog should be disabled
    When I add "webship-test-invite@example.com" to the invitation
    Then the button "Send invitation" of the dialog should be enabled
    When I close the dialog
    Then no dialog should be open
    And the invitations should not list "webship-test-invite@example.com"

  Scenario: A team is made, then deleted
    Given there is no team "Webship test team"
    When I create the team "Webship test team"
    Then the site should say "Team created successfully"
    And the page heading should be "Projects"
    And the team switch should list "Webship test team"
    When I choose "Delete team" in the team options
    Then the site should ask "Are you sure you want to delete this team?"
    When I press "Delete team" in the dialog
    Then the team switch should not list "Webship test team"
    And the team switch should list "Design team"
