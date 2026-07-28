@add-goal
Feature: Create Goal modal

  Selecting "Goal" from the add-item menu opens a modal for creating a goal:
  a specific, measurable, significant achievement with a clear and distinct
  completion point. The modal collects a mandatory Title plus optional
  Description/Reason, an unlimited add/remove Milestones section, warns
  before discarding unsaved changes (including an added-but-blank milestone
  row), and persists a saved goal to its own local storage key.

  Background:
    Given the app root element is empty
    And the app is rendered
    And the add-item button is clicked
    And the "Goal" item is selected from the add-item menu

  Scenario: The modal shows the header and blurb before any field
    Then the goal modal is open
    And the goal modal's heading is "Create Goal"
    And the goal modal's blurb text is "A goal is a specific, measurable, significant achievement with a clear and distinct completion point — for example 'get promoted to manager', 'run a marathon', or 'be awarded a degree'."
    And the blurb appears before the Title field in the goal modal

  Scenario: The Title, Description, and Reason fields are present and correctly labeled
    Then the goal modal has a required field labeled "Title"
    And the goal modal has an optional field labeled "Description"
    And the goal modal has an optional field labeled "Reason"

  Scenario: The Save button is disabled while Title is empty or whitespace-only, and enabled once Title has content
    Then the goal modal's Save button is disabled
    When "My goal" is entered into the goal modal's "Title" field
    Then the goal modal's Save button is enabled
    When the goal modal's "Title" field is cleared
    Then the goal modal's Save button is disabled
    When "   " is entered into the goal modal's "Title" field
    Then the goal modal's Save button is disabled

  Scenario: The modal opens with zero milestone rows
    Then the goal modal has 0 milestone rows

  Scenario: Activating "Add milestone" adds one row with its own labeled input and remove control
    When the goal modal's "Add milestone" button is clicked
    Then the goal modal has 1 milestone row
    And the goal modal's milestone row 1 is labeled "Milestone 1"

  Scenario: Activating "Add milestone" repeatedly adds independent rows
    When the goal modal's "Add milestone" button is clicked
    And the goal modal's "Add milestone" button is clicked
    And the goal modal's "Add milestone" button is clicked
    Then the goal modal has 3 milestone rows
    And the goal modal's milestone row 1 is labeled "Milestone 1"
    And the goal modal's milestone row 2 is labeled "Milestone 2"
    And the goal modal's milestone row 3 is labeled "Milestone 3"

  Scenario: Entering text into one milestone row's input doesn't affect other rows
    When the goal modal's "Add milestone" button is clicked
    And the goal modal's "Add milestone" button is clicked
    And "Only this row" is entered into the goal modal's milestone row 1's title field
    Then the goal modal's milestone row 1's title field contains "Only this row"
    And the goal modal's milestone row 2's title field contains ""

  Scenario: Removing a specific milestone row leaves the other rows and their values intact, in order
    When the goal modal's "Add milestone" button is clicked
    And "First" is entered into the goal modal's milestone row 1's title field
    And the goal modal's "Add milestone" button is clicked
    And "Second" is entered into the goal modal's milestone row 2's title field
    And the goal modal's "Add milestone" button is clicked
    And "Third" is entered into the goal modal's milestone row 3's title field
    And the goal modal's milestone row 2 is removed
    Then the goal modal has 2 milestone rows
    And the goal modal's milestone row titles are:
      | First |
      | Third |

  Scenario: Closing via the close button with nothing entered and no milestone rows closes the modal immediately
    When the goal modal's close button is clicked
    Then the goal modal is closed
    And no confirmation prompt is shown
    And focus is on the add-item button

  Scenario: Closing via the close button with only a blank milestone row present shows a confirmation prompt (a divergence from the Aspiration modal)
    When the goal modal's "Add milestone" button is clicked
    And the goal modal's close button is clicked
    Then the confirmation prompt is shown

  Scenario: Discarding from the confirmation prompt when only a milestone row is present closes everything without saving
    When the goal modal's "Add milestone" button is clicked
    And the goal modal's close button is clicked
    Then the confirmation prompt is shown
    When "Discard" is chosen in the confirmation prompt
    Then the goal modal is closed
    And the confirmation prompt is closed
    And no goal has been saved
    And focus is on the add-item button

  Scenario: Closing via the close button with unsaved Title/Description/Reason content shows a confirmation prompt, and Discard closes everything without saving
    When "My goal" is entered into the goal modal's "Title" field
    And the goal modal's close button is clicked
    Then the confirmation prompt is shown
    When "Discard" is chosen in the confirmation prompt
    Then the goal modal is closed
    And the confirmation prompt is closed
    And no goal has been saved
    And focus is on the add-item button

  Scenario: Choosing "Keep editing" in the confirmation prompt returns to the modal with its text content intact
    When "My goal" is entered into the goal modal's "Title" field
    And the goal modal's close button is clicked
    Then the confirmation prompt is shown
    When "Keep editing" is chosen in the confirmation prompt
    Then the confirmation prompt is closed
    And the goal modal is open
    And the goal modal's "Title" field contains "My goal"

  Scenario: Choosing "Keep editing" in the confirmation prompt returns to the modal with its milestone rows intact
    When the goal modal's "Add milestone" button is clicked
    And "Keep this" is entered into the goal modal's milestone row 1's title field
    And the goal modal's close button is clicked
    Then the confirmation prompt is shown
    When "Keep editing" is chosen in the confirmation prompt
    Then the confirmation prompt is closed
    And the goal modal is open
    And the goal modal has 1 milestone row
    And the goal modal's milestone row 1's title field contains "Keep this"

  Scenario: Pressing Escape with unsaved content triggers the same confirmation flow as the close button
    When "My goal" is entered into the goal modal's "Title" field
    And the Escape key is pressed
    Then the confirmation prompt is shown

  Scenario: Clicking the backdrop with unsaved content triggers the same confirmation flow as the close button
    When "My goal" is entered into the goal modal's "Title" field
    And the goal modal's backdrop is clicked
    Then the confirmation prompt is shown

  Scenario: Saving with only a Title persists a goal record and closes the modal with no confirmation
    When "My first goal" is entered into the goal modal's "Title" field
    And the goal modal's Save button is clicked
    Then the goal modal is closed
    And no confirmation prompt is shown
    And exactly 1 goal is saved in local storage
    And the saved goal has title "My first goal", description "", and reason ""
    And the saved goal has 0 milestones

  Scenario: Saving with a blank milestone row and a filled milestone row persists only the filled one
    When "Learn to paint" is entered into the goal modal's "Title" field
    And the goal modal's "Add milestone" button is clicked
    And "Take a beginner class" is entered into the goal modal's milestone row 1's title field
    And the goal modal's "Add milestone" button is clicked
    And the goal modal's Save button is clicked
    Then exactly 1 goal is saved in local storage
    And the saved goal's milestones are:
      | Take a beginner class |

  Scenario: Saving with Title, Description, Reason, and milestones persists a full goal record in order
    When "Run a marathon" is entered into the goal modal's "Title" field
    And "Complete a 26.2 mile race" is entered into the goal modal's "Description" field
    And "To prove I can do it" is entered into the goal modal's "Reason" field
    And the goal modal's "Add milestone" button is clicked
    And "Run a 5k" is entered into the goal modal's milestone row 1's title field
    And the goal modal's "Add milestone" button is clicked
    And "Run a half-marathon" is entered into the goal modal's milestone row 2's title field
    And the goal modal's Save button is clicked
    Then the goal modal is closed
    And no confirmation prompt is shown
    And exactly 1 goal is saved in local storage
    And the saved goal has title "Run a marathon", description "Complete a 26.2 mile race", and reason "To prove I can do it"
    And the saved goal's milestones are:
      | Run a 5k           |
      | Run a half-marathon |

  Scenario: Saving twice results in two independent stored records, each with its own milestone list
    When "First goal" is entered into the goal modal's "Title" field
    And the goal modal's "Add milestone" button is clicked
    And "Milestone A" is entered into the goal modal's milestone row 1's title field
    And the goal modal's Save button is clicked
    And the add-item button is clicked
    And the "Goal" item is selected from the add-item menu
    And "Second goal" is entered into the goal modal's "Title" field
    And the goal modal's Save button is clicked
    Then exactly 2 goals are saved in local storage
    And the saved goals' titles are "First goal" and "Second goal" in order
    And the saved goal titled "First goal" has milestones:
      | Milestone A |
    And the saved goal titled "Second goal" has 0 milestones

  Scenario: Selecting "Goal" again while the modal is already open does not open a duplicate
    When the add-item button is clicked
    And the "Goal" item is selected from the add-item menu
    Then exactly 1 goal modal is open

  Scenario: The Create Goal modal being open makes the rest of the app, including the add-item button, inert — so the Create Aspiration modal cannot be reached without first closing it
    Then the app root element is inert
