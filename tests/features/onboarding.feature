@session @onboarding
Feature: The onboarding of a new account
  As a person who logs in for the first time
  I want a few questions and the choice of a team before the dashboard
  So that the platform starts where I need it

  # The answers of the questionnaire, once sent with "Start", stay on the account for good: the first scenario walks
  # the questionnaire of the account that never answered it (the build leaves "admin" so) without sending them.
  Scenario: A new account walks the questionnaire, each step waiting for its answers
    Given "admin" has not done the onboarding yet
    When I log in as "admin" with the login form
    Then the onboarding should ask "Help us get to know you"
    And the button "Next" of the onboarding should be disabled
    When I choose "Personal" in the onboarding
    And I choose "Product Management" in the onboarding
    Then the button "Next" of the onboarding should be enabled
    When I press "Next" in the onboarding
    Then the onboarding should ask "Which one of these tools do you use the most?"
    When I choose "Other" in the onboarding
    And I answer "Webship test" in the box "Other (specify)" of the onboarding
    And I press "Next" in the onboarding
    Then the onboarding should ask "Where would you like to get started?"
    And the button "Start" of the onboarding should be disabled
    When I choose "Prototyping" in the onboarding
    Then the button "Start" of the onboarding should be enabled
    When I press "Previous" in the onboarding
    Then the onboarding should ask "Which one of these tools do you use the most?"

  Scenario: An account that answered the questionnaire goes on without a team
    Given "viewer" has not done the onboarding yet
    When I log in as "viewer" with the login form
    Then the onboarding should ask "What's a team?"
    When I press "Continue without team" in the onboarding
    Then the onboarding should be over
    And I should be logged in as "viewer"
