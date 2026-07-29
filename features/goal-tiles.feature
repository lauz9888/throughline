Feature: Goal tile grid and Edit Goal modal

  The site shows a tile for every goal stored in local storage, laid out
  below the Aspirations grid in alphabetical order. Selecting a tile opens
  an Edit Goal modal, pre-populated with that goal's data — including one
  row per stored milestone — sharing Create Goal's structure/behavior but
  adding a Delete control. Saving or deleting updates the tile grid and
  closes the modal.

  Background:
    Given the app root element is empty

  Scenario: With no stored goals, the empty-state message is shown and no tiles are rendered
    When the app is rendered
    Then the goal grid shows the empty-state message "You don't have any goals yet"
    And the goal grid contains no tiles

  Scenario: Stored goals render as tiles in case-insensitive alphabetical order, with same-title ties broken by createdAt
    Given the following goals are stored:
      | title  | description | reason | createdAt                |
      | Cherry |             |        | 2024-01-01T00:00:00.000Z |
      | banana |             |        | 2024-01-02T00:00:00.000Z |
      | Apple  |             |        | 2024-01-03T00:00:00.000Z |
      | apple  |             |        | 2024-01-04T00:00:00.000Z |
    When the app is rendered
    Then the goal grid shows tiles with titles in this order:
      | Apple  |
      | apple  |
      | banana |
      | Cherry |

  Scenario: A tile's accessible name is its full, untruncated title
    Given the following goals are stored:
      | title                                                                    | description | reason |
      | GoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoal | |        |
    When the app is rendered
    Then the goal tile titled "GoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoal" has an accessible name of "GoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoalGoal"

  Scenario: Selecting a tile opens Edit Goal pre-populated with that goal's data, including its milestones
    Given the following goals are stored:
      | title   | description   | reason         | milestones                    |
      | My goal | A description | A good reason  | Run a 5k, Run a half-marathon |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    Then the edit goal modal is open
    And the edit goal modal's heading is "Edit Goal"
    And the edit goal modal's "Title" field contains "My goal"
    And the edit goal modal's "Description" field contains "A description"
    And the edit goal modal's "Reason" field contains "A good reason"
    And the edit goal modal has 2 milestone rows
    And the edit goal modal's milestone row 1 is labeled "Milestone 1"
    And the edit goal modal's milestone row 1's title field contains "Run a 5k"
    And the edit goal modal's milestone row 2 is labeled "Milestone 2"
    And the edit goal modal's milestone row 2's title field contains "Run a half-marathon"

  Scenario: Edit's Save button starts disabled, enables once a field is changed, and disables again once reverted
    Given the following goals are stored:
      | title   | description   | reason         |
      | My goal | A description | A good reason  |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    Then the edit goal modal's Save button is disabled
    When "My goal!" is entered into the edit goal modal's "Title" field
    Then the edit goal modal's Save button is enabled
    When "My goal" is entered into the edit goal modal's "Title" field
    Then the edit goal modal's Save button is disabled

  Scenario: Edit's Save button enables when a milestone row is added, edited, or removed, and disables again when reverted to the original set
    Given the following goals are stored:
      | title   | description   | reason         | milestones           |
      | My goal | A description | A good reason  | Run a 5k, Run a 10k  |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    Then the edit goal modal's Save button is disabled
    When "Run a half-marathon" is entered into the edit goal modal's milestone row 1's title field
    Then the edit goal modal's Save button is enabled
    When "Run a 5k" is entered into the edit goal modal's milestone row 1's title field
    Then the edit goal modal's Save button is disabled
    When the edit goal modal's milestone row 2 is removed
    Then the edit goal modal's Save button is enabled
    When the edit goal modal's "Add milestone" button is clicked
    And "Run a 10k" is entered into the edit goal modal's milestone row 2's title field
    Then the edit goal modal's Save button is disabled

  Scenario: Saving an edit updates the stored record and the visible tile
    Given the following goals are stored:
      | title   | description   | reason         | milestones           |
      | My goal | A description | A good reason  | Run a 5k, Run a 10k  |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    And "Updated goal" is entered into the edit goal modal's "Title" field
    And the edit goal modal's milestone row 2 is removed
    And the edit goal modal's "Add milestone" button is clicked
    And "Run a half-marathon" is entered into the edit goal modal's milestone row 2's title field
    And the edit goal modal's Save button is clicked
    Then the edit goal modal is closed
    And exactly 1 goal is saved in local storage
    And the saved goal has title "Updated goal", description "A description", and reason "A good reason"
    And the saved goal's milestones are:
      | Run a 5k            |
      | Run a half-marathon |
    And the saved goal's id and createdAt are unchanged from when it was stored
    And the goal grid shows tiles with titles in this order:
      | Updated goal |

  Scenario: Selecting Delete opens a confirmation prompt without deleting the goal
    Given the following goals are stored:
      | title   | description   | reason         | milestones |
      | My goal | A description | A good reason  | Run a 5k   |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    And the edit goal modal's Delete button is clicked
    Then the edit goal delete confirmation prompt is shown
    And exactly 1 goal is saved in local storage

  Scenario: Choosing "Keep editing" in the delete confirmation returns to the unchanged Edit modal, with milestone rows intact
    Given the following goals are stored:
      | title   | description   | reason         | milestones |
      | My goal | A description | A good reason  | Run a 5k   |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    And the edit goal modal's Delete button is clicked
    And "Keep editing" is chosen in the edit goal delete confirmation prompt
    Then the edit goal delete confirmation prompt is closed
    And the edit goal modal is open
    And the edit goal modal's "Title" field contains "My goal"
    And the edit goal modal has 1 milestone row
    And the edit goal modal's milestone row 1's title field contains "Run a 5k"
    And exactly 1 goal is saved in local storage

  Scenario: Confirming deletion removes the goal and its milestones, and closes both dialogs
    Given the following goals are stored:
      | title   | description   | reason         | milestones |
      | My goal | A description | A good reason  | Run a 5k   |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    And the edit goal modal's Delete button is clicked
    And "Delete" is chosen in the edit goal delete confirmation prompt
    Then the edit goal delete confirmation prompt is closed
    And the edit goal modal is closed
    And no goal has been saved
    And the goal grid shows the empty-state message "You don't have any goals yet"

  Scenario: Closing Edit with no changes closes immediately with no confirmation
    Given the following goals are stored:
      | title   | description   | reason         |
      | My goal | A description | A good reason  |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    And the edit goal modal's close button is clicked
    Then the edit goal modal is closed
    And no confirmation prompt is shown

  Scenario: Closing Edit with unsaved field changes prompts a discard confirmation, and Discard closes without saving
    Given the following goals are stored:
      | title   | description   | reason         |
      | My goal | A description | A good reason  |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    And "Updated title" is entered into the edit goal modal's "Title" field
    And the edit goal modal's close button is clicked
    Then the edit goal discard confirmation prompt is shown
    When "Discard" is chosen in the edit goal discard confirmation prompt
    Then the edit goal modal is closed
    And the edit goal discard confirmation prompt is closed
    And the saved goal has title "My goal", description "A description", and reason "A good reason"

  Scenario: Closing Edit with an unsaved milestone-only edit also prompts a discard confirmation, and Discard closes without saving
    Given the following goals are stored:
      | title   | description   | reason         | milestones |
      | My goal | A description | A good reason  | Run a 5k   |
    When the app is rendered
    And the goal tile titled "My goal" is selected
    And "Run a 10k" is entered into the edit goal modal's milestone row 1's title field
    And the edit goal modal's close button is clicked
    Then the edit goal discard confirmation prompt is shown
    When "Discard" is chosen in the edit goal discard confirmation prompt
    Then the edit goal modal is closed
    And the edit goal discard confirmation prompt is closed
    And the saved goal's milestones are:
      | Run a 5k |
