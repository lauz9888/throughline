Feature: Blank page with wordmark

  The site's root page renders nothing but the "throughline" wordmark, exposed
  as real accessible text, so it reads as a deliberate blank page with a logo
  rather than an empty or broken page.

  Scenario: The wordmark is the only content rendered
    Given the app root element is empty
    When the app is rendered
    Then the app root element contains exactly one child element
    And the rendered content includes the text "throughline"
    And that element's accessible text is "throughline"
