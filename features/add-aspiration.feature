Feature: Create Aspiration modal

  Selecting "Aspiration" from the add-item menu opens a modal for creating an
  aspiration: a long-term, potentially lifelong life direction. The modal
  collects a mandatory Title plus optional Description/Reason, offers a
  Goals/Habits "Links" toggle (scoped to the toggle and an unconditional
  empty-state message this run), warns before discarding unsaved changes, and
  persists a saved aspiration to local storage.

  Background:
    Given the app root element is empty
    And the app is rendered
    And the add-item button is clicked
    And the "Aspiration" item is selected from the add-item menu

  Scenario: The modal shows the header and blurb before any field
    Then the aspiration modal is open
    And the aspiration modal's heading is "Create Aspiration"
    And the aspiration modal's blurb text is "An aspiration is a long-term, potentially lifelong life direction — not necessarily a measurable, checkable goal. It's a guiding principle that shapes and motivates your more concrete goals, for example 'live a healthy life', 'have a successful and fulfilling career', or 'maintain healthy and loving relationships'."
    And the blurb appears before the Title field in the modal

  Scenario: The Title, Description, and Reason fields are present and correctly labeled
    Then the aspiration modal has a required field labeled "Title"
    And the aspiration modal has an optional field labeled "Description"
    And the aspiration modal has an optional field labeled "Reason"

  Scenario: The Save button is disabled while Title is empty or whitespace-only, and enabled once Title has content
    Then the aspiration modal's Save button is disabled
    When "My aspiration" is entered into the aspiration modal's "Title" field
    Then the aspiration modal's Save button is enabled
    When the aspiration modal's "Title" field is cleared
    Then the aspiration modal's Save button is disabled
    When "   " is entered into the aspiration modal's "Title" field
    Then the aspiration modal's Save button is disabled

  Scenario: The Links section starts with neither radio selected, toggles the empty-state message, and supports re-click deselection
    Then neither the "Goals" nor the "Habits" link radio button is selected
    And the links empty-state message is hidden
    When the "Goals" link radio button is clicked
    Then the "Goals" link radio button is selected
    And the links empty-state message is visible with text "You don't have any Goals yet, so there's nothing to link."
    When the "Habits" link radio button is clicked
    Then the "Habits" link radio button is selected
    And the "Goals" link radio button is not selected
    And the links empty-state message is visible with text "You don't have any Habits yet, so there's nothing to link."
    When the "Habits" link radio button is clicked
    Then neither the "Goals" nor the "Habits" link radio button is selected
    And the links empty-state message is hidden

  Scenario: Closing via the close button with nothing entered closes the modal immediately
    When the aspiration modal's close button is clicked
    Then the aspiration modal is closed
    And no confirmation prompt is shown
    And focus is on the add-item button

  Scenario: Closing via the close button with unsaved content shows a confirmation prompt, and Discard closes everything without saving
    When "My aspiration" is entered into the aspiration modal's "Title" field
    And the aspiration modal's close button is clicked
    Then the confirmation prompt is shown
    When "Discard" is chosen in the confirmation prompt
    Then the aspiration modal is closed
    And the confirmation prompt is closed
    And no aspiration has been saved
    And focus is on the add-item button

  Scenario: Choosing "Keep editing" in the confirmation prompt returns to the modal with its content intact
    When "My aspiration" is entered into the aspiration modal's "Title" field
    And the aspiration modal's close button is clicked
    Then the confirmation prompt is shown
    When "Keep editing" is chosen in the confirmation prompt
    Then the confirmation prompt is closed
    And the aspiration modal is open
    And the aspiration modal's "Title" field contains "My aspiration"

  Scenario: Pressing Escape with unsaved content triggers the same confirmation flow as the close button
    When "My aspiration" is entered into the aspiration modal's "Title" field
    And the Escape key is pressed
    Then the confirmation prompt is shown

  Scenario: Clicking the backdrop with unsaved content triggers the same confirmation flow as the close button
    When "My aspiration" is entered into the aspiration modal's "Title" field
    And the aspiration modal's backdrop is clicked
    Then the confirmation prompt is shown

  Scenario: Saving with a Title persists a new aspiration record and closes the modal with no confirmation
    When "My first aspiration" is entered into the aspiration modal's "Title" field
    And "A helpful description" is entered into the aspiration modal's "Description" field
    And "Because it matters to me" is entered into the aspiration modal's "Reason" field
    And the aspiration modal's Save button is clicked
    Then the aspiration modal is closed
    And no confirmation prompt is shown
    And exactly 1 aspiration is saved in local storage
    And the saved aspiration has title "My first aspiration", description "A helpful description", and reason "Because it matters to me"

  Scenario: Saving twice results in two independent stored records, neither overwriting the other
    When "First aspiration" is entered into the aspiration modal's "Title" field
    And the aspiration modal's Save button is clicked
    And the add-item button is clicked
    And the "Aspiration" item is selected from the add-item menu
    And "Second aspiration" is entered into the aspiration modal's "Title" field
    And the aspiration modal's Save button is clicked
    Then exactly 2 aspirations are saved in local storage
    And the saved aspirations' titles are "First aspiration" and "Second aspiration" in order

  Scenario: Selecting "Aspiration" again while the modal is already open does not open a duplicate
    When the add-item button is clicked
    And the "Aspiration" item is selected from the add-item menu
    Then exactly 1 aspiration modal is open
