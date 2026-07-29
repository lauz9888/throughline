import { describe, it, expect, beforeEach } from 'vitest';
import { buildGoalFields, type GoalFieldsResult } from './goal-fields';

function appendFields(result: GoalFieldsResult): void {
  document.body.append(result.titleField, result.descriptionField, result.reasonField);
}

describe('buildGoalFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('produces ids prefixed with the given idPrefix (Requirement 38)', () => {
    const result = buildGoalFields(document, 'goal');

    expect(result.titleInput.id).toBe('goal-field-title');
    expect(result.descriptionInput.id).toBe('goal-field-description');
    expect(result.reasonInput.id).toBe('goal-field-reason');
  });

  it('two calls with different prefixes never collide', () => {
    const first = buildGoalFields(document, 'goal');
    const second = buildGoalFields(document, 'other-goal');

    expect(first.titleInput.id).not.toBe(second.titleInput.id);
  });

  it('pre-fills titleInput/descriptionInput/reasonInput from initialValues', () => {
    const result = buildGoalFields(document, 'edit-goal', {
      title: 'My title',
      description: 'My description',
      reason: 'My reason',
    });

    expect(result.titleInput.value).toBe('My title');
    expect(result.descriptionInput.value).toBe('My description');
    expect(result.reasonInput.value).toBe('My reason');
  });

  it('leaves fields empty when initialValues is omitted (Create usage)', () => {
    const result = buildGoalFields(document, 'goal');

    expect(result.titleInput.value).toBe('');
    expect(result.descriptionInput.value).toBe('');
    expect(result.reasonInput.value).toBe('');
  });

  it('labels Title/Description/Reason correctly (Requirements 6, 7, 8, 38)', () => {
    const result = buildGoalFields(document, 'goal');
    appendFields(result);

    expect(document.querySelector('label[for="goal-field-title"]')?.textContent).toBe('Title');
    expect(document.querySelector('label[for="goal-field-description"]')?.textContent).toBe(
      'Description',
    );
    expect(document.querySelector('label[for="goal-field-reason"]')?.textContent).toBe('Reason');
  });

  it('marks Title as required/aria-required, and leaves Description/Reason unrequired (Requirement 39)', () => {
    const result = buildGoalFields(document, 'goal');

    expect(result.titleInput.required).toBe(true);
    expect(result.titleInput.getAttribute('aria-required')).toBe('true');
    expect(result.descriptionInput.hasAttribute('required')).toBe(false);
    expect(result.descriptionInput.hasAttribute('aria-required')).toBe(false);
    expect(result.reasonInput.hasAttribute('required')).toBe(false);
    expect(result.reasonInput.hasAttribute('aria-required')).toBe(false);
  });

  it('builds Description/Reason as multi-line <textarea> controls (Requirements 7, 8)', () => {
    const result = buildGoalFields(document, 'goal');

    expect(result.descriptionInput.tagName).toBe('TEXTAREA');
    expect(result.reasonInput.tagName).toBe('TEXTAREA');
    expect(result.titleInput.tagName).toBe('INPUT');
  });

  it("each field's aria-describedby resolves to a tooltip span containing goal-specific copy, not the aspiration copy (Requirement 9)", () => {
    const result = buildGoalFields(document, 'goal');
    appendFields(result);

    const titleTooltipId = result.titleInput.getAttribute('aria-describedby')!;
    const descriptionTooltipId = result.descriptionInput.getAttribute('aria-describedby')!;
    const reasonTooltipId = result.reasonInput.getAttribute('aria-describedby')!;

    const titleTooltipText = document.getElementById(titleTooltipId)?.textContent ?? '';
    const descriptionTooltipText = document.getElementById(descriptionTooltipId)?.textContent ?? '';
    const reasonTooltipText = document.getElementById(reasonTooltipId)?.textContent ?? '';

    expect(titleTooltipText).toContain('A short, memorable name for this goal');
    expect(titleTooltipText).not.toContain('aspiration');

    expect(descriptionTooltipText).toContain(
      'Add more detail about what achieving this goal looks like',
    );
    expect(descriptionTooltipText).not.toContain('aspiration');

    expect(reasonTooltipText).toContain('Explain why this goal matters to you');
    expect(reasonTooltipText).not.toContain('aspiration');
  });

  it('does not build or return any Links-related fields (mirrors the aspiration-fields regression guard)', () => {
    const result = buildGoalFields(document, 'goal') as unknown as Record<string, unknown>;

    expect(result.linksFieldset).toBeUndefined();
    expect(result.goalsRadio).toBeUndefined();
    expect(result.habitsRadio).toBeUndefined();
    expect(result.linksEmptyMessage).toBeUndefined();
    expect(result.linksIcon).toBeUndefined();
    expect(result.linksTooltip).toBeUndefined();
    expect(result.getSelectedLinkType).toBeUndefined();
    expect(result.updateLinksState).toBeUndefined();
  });

  it('isTooltipOpen()/hideOpenTooltip() are exposed and functional, opening the Title tooltip via its info icon', () => {
    const result = buildGoalFields(document, 'goal');
    appendFields(result);

    expect(result.isTooltipOpen()).toBe(false);

    result.titleIcon.click();

    expect(result.isTooltipOpen()).toBe(true);
    expect(result.titleTooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);

    const closed = result.hideOpenTooltip();
    expect(closed).toBe(true);
    expect(result.isTooltipOpen()).toBe(false);
  });
});
