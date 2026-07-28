import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildTextField,
  createTooltipController,
  createInfoIcon,
  createTooltipText,
  type TextFieldOptions,
} from './field-kit';

function baseOptions(overrides: Partial<TextFieldOptions> = {}): TextFieldOptions {
  return {
    idPrefix: 'widget',
    fieldKey: 'title',
    labelText: 'Title',
    controlType: 'input',
    tooltipText: 'Some tooltip text',
    ...overrides,
  };
}

describe('buildTextField', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('builds an input control with id `${idPrefix}-field-${fieldKey}`, a matching <label for>, and the tooltip span wired via aria-describedby', () => {
    const controller = createTooltipController();
    const result = buildTextField(document, baseOptions(), controller);
    document.body.append(result.field);

    expect(result.input.tagName).toBe('INPUT');
    expect(result.input.id).toBe('widget-field-title');
    expect((result.input as HTMLInputElement).type).toBe('text');

    const label = result.field.querySelector('label');
    expect(label?.getAttribute('for')).toBe('widget-field-title');
    expect(label?.textContent).toBe('Title');

    const describedBy = result.input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(result.tooltip.id).toBe(describedBy);
    expect(result.tooltip.textContent).toBe('Some tooltip text');
  });

  it('sets type="text"/required/aria-required only when controlType is "input" and required is true', () => {
    const controller = createTooltipController();

    const requiredInput = buildTextField(
      document,
      baseOptions({ fieldKey: 'required-input', required: true }),
      controller,
    );
    expect((requiredInput.input as HTMLInputElement).required).toBe(true);
    expect(requiredInput.input.getAttribute('aria-required')).toBe('true');

    const optionalInput = buildTextField(
      document,
      baseOptions({ fieldKey: 'optional-input', required: false }),
      controller,
    );
    expect(optionalInput.input.hasAttribute('required')).toBe(false);
    expect(optionalInput.input.hasAttribute('aria-required')).toBe(false);
  });

  it('builds a <textarea> control for controlType "textarea", without required/aria-required even if required is true', () => {
    const controller = createTooltipController();

    const result = buildTextField(
      document,
      baseOptions({ fieldKey: 'description', controlType: 'textarea', required: true }),
      controller,
    );

    expect(result.input.tagName).toBe('TEXTAREA');
    expect(result.input.hasAttribute('required')).toBe(false);
    expect(result.input.hasAttribute('aria-required')).toBe(false);
  });

  it('pre-fills the control from initialValue when provided', () => {
    const controller = createTooltipController();

    const result = buildTextField(
      document,
      baseOptions({ initialValue: 'Prefilled value' }),
      controller,
    );

    expect(result.input.value).toBe('Prefilled value');
  });

  it('leaves the control empty when initialValue is omitted', () => {
    const controller = createTooltipController();

    const result = buildTextField(document, baseOptions(), controller);

    expect(result.input.value).toBe('');
  });

  it('registers the built icon/tooltip pair with the given tooltip controller, so clicking the icon toggles the tooltip', () => {
    const controller = createTooltipController();
    const result = buildTextField(document, baseOptions(), controller);
    document.body.append(result.field);

    expect(controller.isTooltipOpen()).toBe(false);

    result.icon.click();

    expect(controller.isTooltipOpen()).toBe(true);
    expect(result.tooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);
    expect(result.icon.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('createTooltipController', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function makePair(
    doc: Document,
    label: string,
    tooltipId: string,
    text: string,
  ): { icon: HTMLButtonElement; tooltip: HTMLElement } {
    const icon = createInfoIcon(doc, label, tooltipId);
    const tooltip = createTooltipText(doc, tooltipId, text);
    doc.body.append(icon, tooltip);
    return { icon, tooltip };
  }

  it('starts with isTooltipOpen() false', () => {
    const controller = createTooltipController();
    expect(controller.isTooltipOpen()).toBe(false);
  });

  it('registerIcon wires click-to-toggle for an arbitrary icon/text pair, independent of any specific field/modal', () => {
    const controller = createTooltipController();
    const { icon, tooltip } = makePair(document, 'Field A', 'field-a-tooltip', 'A text');
    controller.registerIcon(icon, tooltip);

    icon.click();
    expect(controller.isTooltipOpen()).toBe(true);
    expect(tooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);

    icon.click();
    expect(controller.isTooltipOpen()).toBe(false);
    expect(tooltip.classList.contains('modal__tooltip-text--visible')).toBe(false);
  });

  it('opening a second registered tooltip closes the first (only one open at a time)', () => {
    const controller = createTooltipController();
    const a = makePair(document, 'Field A', 'field-a-tooltip', 'A text');
    const b = makePair(document, 'Field B', 'field-b-tooltip', 'B text');
    controller.registerIcon(a.icon, a.tooltip);
    controller.registerIcon(b.icon, b.tooltip);

    a.icon.click();
    expect(a.tooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);

    b.icon.click();
    expect(a.tooltip.classList.contains('modal__tooltip-text--visible')).toBe(false);
    expect(a.icon.getAttribute('aria-expanded')).toBe('false');
    expect(b.tooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);
    expect(controller.isTooltipOpen()).toBe(true);
  });

  it('a click outside the open tooltip icon/text closes it via handleDocumentClickForTooltip; a click inside the tooltip text does not', () => {
    const controller = createTooltipController();
    const a = makePair(document, 'Field A', 'field-a-tooltip', 'A text');
    controller.registerIcon(a.icon, a.tooltip);
    document.addEventListener('click', controller.handleDocumentClickForTooltip);

    try {
      a.icon.click();
      expect(controller.isTooltipOpen()).toBe(true);

      a.tooltip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(controller.isTooltipOpen()).toBe(true);

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(controller.isTooltipOpen()).toBe(false);
    } finally {
      document.removeEventListener('click', controller.handleDocumentClickForTooltip);
    }
  });

  it('hideOpenTooltip() closes whichever tooltip is open and returns true, or is a no-op returning false when nothing is open', () => {
    const controller = createTooltipController();
    const a = makePair(document, 'Field A', 'field-a-tooltip', 'A text');
    controller.registerIcon(a.icon, a.tooltip);

    expect(controller.hideOpenTooltip()).toBe(false);

    a.icon.click();
    expect(controller.hideOpenTooltip()).toBe(true);
    expect(controller.isTooltipOpen()).toBe(false);
    expect(a.tooltip.classList.contains('modal__tooltip-text--visible')).toBe(false);
    expect(a.icon.getAttribute('aria-expanded')).toBe('false');
  });
});
