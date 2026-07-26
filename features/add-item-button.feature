Feature: Add-item button and dropdown

  The top bar includes an add-item button that reveals a dropdown of item
  types to create. The dropdown stays closed until the user opens it, exposes
  itself correctly to assistive technology, and can be closed again by
  re-activating the button or pressing Escape.

  Background:
    Given the app root element is empty
    And the app is rendered

  Scenario: The dropdown is closed by default
    Then the add-item menu is hidden
    And the add-item button's expanded state is "false"

  Scenario: The add-item button exposes accessible attributes
    Then the add-item button's accessible name is "Add item"
    And the add-item button has attribute "aria-haspopup" with value "true"
    And the add-item button has attribute "aria-controls" with value "add-item-menu"

  Scenario: Clicking the add-item button opens the dropdown with the item types in order
    When the add-item button is clicked
    Then the add-item menu is visible
    And the add-item button's expanded state is "true"
    And the add-item menu contains the following menu items in order:
      | Aspiration |
      | Goal       |
      | Task       |
      | Habit      |

  Scenario: Clicking the add-item button again closes the dropdown
    When the add-item button is clicked
    And the add-item button is clicked
    Then the add-item menu is hidden
    And the add-item button's expanded state is "false"

  Scenario: Pressing Escape closes the dropdown and returns focus to the button
    When the add-item button is clicked
    And the Escape key is pressed
    Then the add-item menu is hidden
    And focus is on the add-item button
