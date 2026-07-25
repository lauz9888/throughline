Feature: Top bar with wordmark

  The site's root page renders a top bar containing the "throughline"
  wordmark, exposed as real accessible text, so it reads as a deliberate
  branded page rather than an empty or broken page. (The top bar also hosts
  an add-item button, covered separately in add-item-button.feature.)

  Scenario: The wordmark is present in the rendered top bar
    Given the app root element is empty
    When the app is rendered
    Then the app root element contains exactly two top-level children
    And the rendered content includes the text "throughline"
    And that element's accessible text is "throughline"
