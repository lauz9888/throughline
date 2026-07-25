const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createFocusTrap(container: HTMLElement): () => void {
  function focusableElements(): HTMLElement[] {
    const all = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Native radio-group semantics: within a group of same-`name` radio inputs, only one is
    // ever a real Tab stop at a time — the checked radio, or (if none is checked) the first
    // radio encountered in DOM order. Without accounting for this, the trap's own notion of
    // "first"/"last" focusable element can disagree with where the browser's native Tab key
    // actually lands, letting focus escape the container in a real browser even though this
    // naive list looked correct.
    const radioGroupFirstSeen = new Map<string, HTMLInputElement>();
    const radioGroupChecked = new Map<string, HTMLInputElement>();
    for (const el of all) {
      if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
        if (!radioGroupFirstSeen.has(el.name)) radioGroupFirstSeen.set(el.name, el);
        if (el.checked) radioGroupChecked.set(el.name, el);
      }
    }

    return all.filter((el) => {
      if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
        const tabStop = radioGroupChecked.get(el.name) ?? radioGroupFirstSeen.get(el.name);
        return el === tabStop;
      }
      return true;
    });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const elements = focusableElements();
    if (elements.length === 0) return;
    const first = elements[0]!;
    const last = elements[elements.length - 1]!;
    const active = container.ownerDocument.activeElement;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', handleKeydown);
  return () => container.removeEventListener('keydown', handleKeydown);
}
