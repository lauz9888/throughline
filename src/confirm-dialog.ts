import { createFocusTrap } from './focus-trap';

export interface ConfirmDialogOptions {
  headingId: string;
  headingText: string;
  bodyId: string;
  bodyText: string;
  cancelText: string;
  cancelClassName: string; // default-focused, non-destructive
  confirmText: string;
  confirmClassName: string; // destructive/continue action
}

export interface ConfirmDialogCallbacks {
  onCancel: () => void;
  onConfirm: () => void;
}

export function openConfirmDialog(
  doc: Document,
  parentDialog: HTMLElement,
  options: ConfirmDialogOptions,
  callbacks: ConfirmDialogCallbacks,
): { cancel: () => void } {
  const overlay = doc.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = doc.createElement('div');
  dialog.className = 'modal modal--confirm';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', options.headingId);
  dialog.setAttribute('aria-describedby', options.bodyId);

  const heading = doc.createElement('h2');
  heading.id = options.headingId;
  heading.className = 'modal__title';
  heading.textContent = options.headingText;

  const body = doc.createElement('p');
  body.id = options.bodyId;
  body.textContent = options.bodyText;

  const actions = doc.createElement('div');
  actions.className = 'modal__actions';

  const cancelButton = doc.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = options.cancelClassName;
  cancelButton.textContent = options.cancelText;

  const confirmButton = doc.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = options.confirmClassName;
  confirmButton.textContent = options.confirmText;

  actions.append(cancelButton, confirmButton);
  dialog.append(heading, body, actions);
  overlay.append(dialog);
  doc.body.append(overlay);

  parentDialog.inert = true;
  const focusTrapCleanup = createFocusTrap(dialog);
  cancelButton.focus(); // the non-destructive default action

  let closed = false;

  function teardown(): void {
    if (closed) return;
    closed = true;
    focusTrapCleanup();
    overlay.remove();
    parentDialog.inert = false;
  }

  function handleCancel(): void {
    if (closed) return;
    teardown();
    callbacks.onCancel();
  }

  function handleConfirm(): void {
    if (closed) return;
    teardown();
    callbacks.onConfirm();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) handleCancel();
  });
  cancelButton.addEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);

  return { cancel: handleCancel };
}
