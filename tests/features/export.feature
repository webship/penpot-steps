@workspace @export
Feature: Exports
  As a member of a team
  I want the boards of a file as a PDF, and the file itself as a file
  So that a design goes where the platform does not

  Scenario: The PDF export lists the boards, all of them or the selected ones
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    And I choose "Export boards as PDF" in the main menu "File"
    Then the dialog should say "2 of 2 elements selected"
    When I press "Hero" in the dialog
    Then the dialog should say "1 of 2 elements selected"
    When I press "Footer" in the dialog
    Then the dialog should say "0 of 2 elements selected"
    And the button "Export" of the dialog should be disabled
    When I press "Cancel" in the dialog
    Then no dialog should be open
    When I select the layer "Hero"
    And I choose "Export boards as PDF" in the main menu "File"
    Then the dialog should say "1 of 1 elements selected"
    When I press "Export" in the dialog to download a file
    Then the downloaded file name should be "Page 1.pdf"
    And the downloaded file should be a PDF of 1 page

  Scenario: A page with no board offers no PDF export
    Given there is a new file "Webship test file" in the project "Webship test project"
    And I am a logged in user with the "editor" user
    When I open the file "Webship test file"
    Then the main menu "File" should not offer "Export boards as PDF"

  Scenario: The file downloaded as a file of its own format
    Given I am a logged in user with the "owner" user
    When I open the file "Homepage"
    And I download the open file
    Then the downloaded file name should be "Homepage.penpot"
    And the downloaded file should be a zip archive containing the following files named:
      | manifest.json |
