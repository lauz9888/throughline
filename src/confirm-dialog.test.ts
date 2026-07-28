import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openConfirmDialog, type ConfirmDialogOptions } from './confirm-dialog';

function buildOptions(overrides: Partial<ConfirmDialogOptions> = {}): ConfirmDialogOptions {
  return {
    headingId: 'test-confirm-heading',
    headingText: 'Discard aspiration?',
    bodyId: 'test-confirm-body',
    bodyText: "You have unsaved changes. If you close now, everything you've entered will be lost.",
    cancelText: 'Keep editing',
    cancelClassName: 'modal__cancel',
    confirmText: 'Discard',
    confirmClassName: 'modal__discard',
    ...overrides,
  };
}

function getAlertDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="alertdialog"]');
}

describe('openConfirmDialog', () => {
  let parentDialog: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    parentDialog = document.createElement('div');
    parentDialog.className = 'modal';
    document.body.append(parentDialog);
  });

  it('inserts one role="alertdialog" with aria-modal, aria-labelledby/aria-describedby resolving to the passed text, sets parentDialog.inert=true, and focuses the cancel button by default', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    openConfirmDialog(document, parentDialog, buildOptions(), { onCancel, onConfirm });

    const alertDialogs = document.querySelectorAll('[role="alertdialog"]');
    expect(alertDialogs).toHaveLength(1);
    const dialog = alertDialogs[0] as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(labelledBy).toBe('test-confirm-heading');
    expect(describedBy).toBe('test-confirm-body');
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Discard aspiration?');
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "You have unsaved changes. If you close now, everything you've entered will be lost.",
    );

    expect(parentDialog.inert).toBe(true);

    const cancelButton = dialog.querySelector<HTMLButtonElement>('.modal__cancel')!;
    expect(document.activeElement).toBe(cancelButton);
  });

  it('clicking the cancel button restores parentDialog.inert=false, removes the overlay, and calls onCancel (not onConfirm)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    openConfirmDialog(document, parentDialog, buildOptions(), { onCancel, onConfirm });

    const dialog = getAlertDialog()!;
    dialog.querySelector<HTMLButtonElement>('.modal__cancel')!.click();

    expect(parentDialog.inert).toBe(false);
    expect(getAlertDialog()).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking the backdrop restores parentDialog.inert=false, removes the overlay, and calls onCancel (not onConfirm)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    openConfirmDialog(document, parentDialog, buildOptions(), { onCancel, onConfirm });

    const dialog = getAlertDialog()!;
    const overlay = dialog.parentElement as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(parentDialog.inert).toBe(false);
    expect(getAlertDialog()).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking the confirm button restores parentDialog.inert=false, removes the overlay, and calls onConfirm (not onCancel)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    openConfirmDialog(document, parentDialog, buildOptions(), { onCancel, onConfirm });

    const dialog = getAlertDialog()!;
    dialog.querySelector<HTMLButtonElement>('.modal__discard')!.click();

    expect(parentDialog.inert).toBe(false);
    expect(getAlertDialog()).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calling the returned cancel() twice in a row invokes onCancel exactly once and does not throw on the second call (idempotency)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    const handle = openConfirmDialog(document, parentDialog, buildOptions(), {
      onCancel,
      onConfirm,
    });

    handle.cancel();
    expect(() => handle.cancel()).not.toThrow();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calling cancel() after the confirm button has already been clicked is a safe no-op (idempotency)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    const handle = openConfirmDialog(document, parentDialog, buildOptions(), {
      onCancel,
      onConfirm,
    });

    const dialog = getAlertDialog()!;
    dialog.querySelector<HTMLButtonElement>('.modal__discard')!.click();

    expect(() => handle.cancel()).not.toThrow();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('traps Tab/Shift+Tab focus within the confirm dialog (delegates to focus-trap.ts)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    openConfirmDialog(document, parentDialog, buildOptions(), { onCancel, onConfirm });

    const dialog = getAlertDialog()!;
    const cancelButton = dialog.querySelector<HTMLButtonElement>('.modal__cancel')!;
    const confirmButton = dialog.querySelector<HTMLButtonElement>('.modal__discard')!;

    confirmButton.focus();
    confirmButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(cancelButton);

    cancelButton.focus();
    cancelButton.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(confirmButton);
  });

  it('appends dialogClassName to the default "modal modal--confirm" classes when supplied (add-goal design decision 3)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    openConfirmDialog(
      document,
      parentDialog,
      buildOptions({ dialogClassName: 'modal--goal' }),
      { onCancel, onConfirm },
    );

    const dialog = getAlertDialog()!;
    expect(dialog.className).toBe('modal modal--confirm modal--goal');
  });

  it('omits any extra class and produces exactly "modal modal--confirm" when dialogClassName is not supplied (no behavior change for existing callers)', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    openConfirmDialog(document, parentDialog, buildOptions(), { onCancel, onConfirm });

    const dialog = getAlertDialog()!;
    expect(dialog.className).toBe('modal modal--confirm');
  });
});
