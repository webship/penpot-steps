@session
Feature: The session
  As a person with an account on the design platform
  I want to log in and out, and to be refused with a clear message when I get it wrong
  So that only the people of a team reach its projects

  Scenario: A visitor is sent to the login page
    Given I am not logged in
    When I go to the homepage
    Then I should be on the login page
    And I should not be logged in

  Scenario: The old addresses of the login and recovery pages still lead there
    Given I am not logged in
    When I go to "/#/auth/login"
    Then I should be on the login page
    And the url should not match "#/auth"
    When I go to "/#/auth/recovery/request"
    Then the page heading should be "Forgot password?"
    When I go to "/?template=foo#/nope"
    Then I should be on the login page

  Scenario: The link of the login page opens the registration form
    Given I am not logged in
    When I follow "Create an account"
    Then I should be on the registration page

  Scenario: An account logs in with the login form and logs out
    When I log in as "editor" with the login form
    Then I should be logged in as "editor"
    When I log out
    Then I should be on the login page
    And I should not be logged in

  Scenario: A malformed address keeps the login form from being sent
    When I log in with the email "not-an-address" and the password "Webship-test-1"
    Then the login should be refused with "Enter a valid email please"
    And I should not be logged in

  @js-off
  Scenario: A wrong password is refused
    When I log in with the email "editor@example.com" and the password "Webship-test-wrong-1"
    Then the login should be refused with "Email or password is incorrect."
    And I should not be logged in

  @js-off
  Scenario: An address without an account is refused
    When I log in with the email "webship-test-nobody@example.com" and the password "Webship-test-wrong-2"
    Then the login should be refused with "Email or password is incorrect."
