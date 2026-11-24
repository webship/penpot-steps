@session @mail
Feature: The password recovery
  As a person who forgot the password of an account
  I want a link by mail to set a new one
  So that I reach my projects again

  Scenario: A recovery link comes by mail and sets a new password
    When I ask for a password reset link for "editor"
    Then the site should say "Password recovery link sent to your inbox."
    And an email with the subject "Password reset" should have been sent to "editor"
    And the email with the subject "Password reset" to "editor" should say "Hello Editor Test!"
    When I open the link of the email with the subject "Password reset" to "editor"
    And I set the password of "editor" on the reset page
    Then I should be on the login page
    When I log in as "editor" with the login form
    Then I should be logged in as "editor"
