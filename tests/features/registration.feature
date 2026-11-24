@session @registration
Feature: The registration form
  As a person with no account yet
  I want the registration form to say what it cannot take
  So that I fix it before I send it; a suite never completes a registration

  @js-off
  Scenario: An address that has an account already is refused
    When I try to register with the name "Webship test", the email "editor@example.com" and the password "Webship-test-1"
    Then the registration should be refused with "Email already used"

  Scenario: A malformed address is refused
    When I try to register with the name "Webship test", the email "not-an-address" and the password "Webship-test-1"
    Then the registration should be refused with "Enter a valid email please"

  Scenario: A short password is refused
    When I try to register with the name "Webship test", the email "webship-test-new@example.com" and the password "short"
    Then the registration should be refused with "Password should at least be 8 characters"

  @mail @js-off
  Scenario: The link of an invitation takes only the address it was sent to
    Given there is no invitation to "webship-test-join@example.com"
    And I am a logged in user with the "owner" user
    And I open the team "Design team"
    When I invite "webship-test-join@example.com" to the team as "Editor"
    Then an email with the subject "has invited you to join the team" should have been sent to "webship-test-join@example.com"
    Given I am not logged in
    When I open the link of the email with the subject "has invited you to join the team" to "webship-test-join@example.com"
    Then I should be on the registration page
    When I try to register with the name "Webship test", the email "webship-test-other@example.com" and the password "Webship-test-1"
    Then the registration should be refused with "Email does not match the invitation."
    And there is no invitation to "webship-test-join@example.com"
