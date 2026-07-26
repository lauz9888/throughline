Feature: Aspiration tile grid and Edit Aspiration modal

  The site shows a tile for every aspiration stored in local storage, laid
  out below the top bar in alphabetical order. Selecting a tile opens an
  Edit Aspiration modal, pre-populated with that aspiration's data, sharing
  Create Aspiration's structure/behavior but adding a Delete control. Saving
  or deleting updates the tile grid and closes the modal.

  Background:
    Given the app root element is empty

  Scenario: With no stored aspirations, the empty-state message is shown and no tiles are rendered
    When the app is rendered
    Then the aspiration grid shows the empty-state message "You don't have any aspirations yet"
    And the aspiration grid contains no tiles

  Scenario: Stored aspirations render as tiles in case-insensitive alphabetical order, with same-title ties broken by createdAt
    Given the following aspirations are stored:
      | title  | description | reason | createdAt                |
      | Cherry |             |        | 2024-01-01T00:00:00.000Z |
      | banana |             |        | 2024-01-02T00:00:00.000Z |
      | Apple  |             |        | 2024-01-03T00:00:00.000Z |
      | apple  |             |        | 2024-01-04T00:00:00.000Z |
    When the app is rendered
    Then the aspiration grid shows tiles with titles in this order:
      | Apple  |
      | apple  |
      | banana |
      | Cherry |

  Scenario: A tile's accessible name is its full, untruncated title
    Given the following aspirations are stored:
      | title                                                                                                | description | reason |
      | AspirationAspirationAspirationAspirationAspirationAspirationAspirationAspirationAspirationAspiration | |        |
    When the app is rendered
    Then the aspiration tile titled "AspirationAspirationAspirationAspirationAspirationAspirationAspirationAspirationAspirationAspiration" has an accessible name of "AspirationAspirationAspirationAspirationAspirationAspirationAspirationAspirationAspirationAspiration"

  Scenario: Selecting a tile opens Edit Aspiration pre-populated with that aspiration's data
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    Then the edit aspiration modal is open
    And the edit aspiration modal's heading is "Edit Aspiration"
    And the edit aspiration modal's "Title" field contains "My aspiration"
    And the edit aspiration modal's "Description" field contains "A description"
    And the edit aspiration modal's "Reason" field contains "A good reason"

  Scenario: Edit's Save button starts disabled, enables once a field is changed, and disables again once reverted
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    Then the edit aspiration modal's Save button is disabled
    When "My aspiration!" is entered into the edit aspiration modal's "Title" field
    Then the edit aspiration modal's Save button is enabled
    When "My aspiration" is entered into the edit aspiration modal's "Title" field
    Then the edit aspiration modal's Save button is disabled

  Scenario: Saving an edit updates the stored record and the visible tile
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    And "Updated aspiration" is entered into the edit aspiration modal's "Title" field
    And the edit aspiration modal's Save button is clicked
    Then the edit aspiration modal is closed
    And exactly 1 aspiration is saved in local storage
    And the saved aspiration has title "Updated aspiration", description "A description", and reason "A good reason"
    And the saved aspiration's id and createdAt are unchanged from when it was stored
    And the aspiration grid shows tiles with titles in this order:
      | Updated aspiration |

  Scenario: Selecting Delete opens a confirmation prompt without deleting the aspiration
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    And the edit aspiration modal's Delete button is clicked
    Then the edit aspiration delete confirmation prompt is shown
    And exactly 1 aspiration is saved in local storage

  Scenario: Choosing "Keep editing" in the delete confirmation returns to the unchanged Edit modal
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    And the edit aspiration modal's Delete button is clicked
    And "Keep editing" is chosen in the edit aspiration delete confirmation prompt
    Then the edit aspiration delete confirmation prompt is closed
    And the edit aspiration modal is open
    And the edit aspiration modal's "Title" field contains "My aspiration"
    And exactly 1 aspiration is saved in local storage

  Scenario: Confirming deletion removes the aspiration and closes both dialogs
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    And the edit aspiration modal's Delete button is clicked
    And "Delete" is chosen in the edit aspiration delete confirmation prompt
    Then the edit aspiration delete confirmation prompt is closed
    And the edit aspiration modal is closed
    And no aspiration has been saved
    And the aspiration grid shows the empty-state message "You don't have any aspirations yet"

  Scenario: Closing Edit with no changes closes immediately with no confirmation
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    And the edit aspiration modal's close button is clicked
    Then the edit aspiration modal is closed
    And no confirmation prompt is shown

  Scenario: Closing Edit with unsaved changes prompts a discard confirmation, and Discard closes without saving
    Given the following aspirations are stored:
      | title         | description   | reason         |
      | My aspiration | A description | A good reason |
    When the app is rendered
    And the aspiration tile titled "My aspiration" is selected
    And "Updated title" is entered into the edit aspiration modal's "Title" field
    And the edit aspiration modal's close button is clicked
    Then the edit aspiration discard confirmation prompt is shown
    When "Discard" is chosen in the edit aspiration discard confirmation prompt
    Then the edit aspiration modal is closed
    And the edit aspiration discard confirmation prompt is closed
    And the saved aspiration has title "My aspiration", description "A description", and reason "A good reason"
