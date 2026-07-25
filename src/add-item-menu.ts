export interface AddItemMenuElements {
  button: HTMLButtonElement;
  menu: HTMLElement;
  onItemSelect?: (label: string) => void;
}

export function initAddItemMenu({ button, menu, onItemSelect }: AddItemMenuElements): () => void {
  const doc = button.ownerDocument;
  const menuItems = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

  const isOpen = () => button.getAttribute('aria-expanded') === 'true';

  function updateRovingTabindex(index: number): void {
    menuItems.forEach((item, i) => {
      item.tabIndex = i === index ? 0 : -1;
    });
  }

  function focusItem(index: number): void {
    updateRovingTabindex(index);
    menuItems[index]?.focus();
  }

  function setOpen(open: boolean, options: { refocusButton?: boolean } = {}): void {
    const wasOpen = isOpen();
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && !wasOpen) {
      updateRovingTabindex(0);
    }
    if (!open && options.refocusButton) {
      button.focus();
    }
  }

  function handleButtonClick(): void {
    setOpen(!isOpen());
  }

  function handleButtonKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      if (isOpen()) return; // let native button activation toggle-close, unchanged from today's click-toggle semantics
      event.preventDefault(); // suppress native click-on-activation; we own the open+focus transition explicitly
      setOpen(true);
      focusItem(0);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen()) setOpen(true);
      focusItem(0);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen()) setOpen(true);
      focusItem(menuItems.length - 1);
    }
  }

  function handleItemClick(event: MouseEvent): void {
    setOpen(false, { refocusButton: true });
    const item = event.currentTarget as HTMLButtonElement;
    onItemSelect?.(item.textContent ?? '');
  }

  function handleItemKeydown(event: KeyboardEvent): void {
    const currentIndex = menuItems.indexOf(event.currentTarget as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem((currentIndex + 1) % menuItems.length);
        return;
      case 'ArrowUp':
        event.preventDefault();
        focusItem((currentIndex - 1 + menuItems.length) % menuItems.length);
        return;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        return;
      case 'End':
        event.preventDefault();
        focusItem(menuItems.length - 1);
        return;
      case 'Tab':
        // Deliberately a no-op (Issue #60 fix). Do NOT call setOpen(false) here: menu.hidden = true
        // would hide the subtree containing this still-focused item, and .add-item-menu[hidden] {
        // display: none } (src/style.css:103) means the browser's synchronous focus-fixup algorithm
        // would move focus to <body> *before* the native Tab default action (which runs after this
        // handler returns, since preventDefault() is never called) gets to compute "next tabbable" —
        // that computation would then start from <body> instead of from this item, plausibly
        // resolving back to #add-item-button instead of whatever really follows the widget. Leaving
        // this branch empty (and never calling preventDefault()) lets the native Tab default action
        // run against the still-visible, unaltered menu and correctly resolve the real next/previous
        // tab stop. The menu is closed afterwards by handleMenuFocusOut, below, once that has
        // happened.
        return;
    }
  }

  function handleMenuFocusOut(event: FocusEvent): void {
    if (menu.hidden) return; // already closed, or closing is already in progress via a synchronous,
    // reentrant focus-fixup nested inside another setOpen(false) call (see the Escape/item-click
    // reentrancy note in Risks/edge cases) — guard on menu.hidden directly (already applied by the
    // time any such nested, fixup-triggered focusout fires) rather than isOpen()/aria-expanded
    // (which setOpen updates one statement later), so this never double-invokes setOpen.
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && menu.contains(nextTarget)) return; // focus moved to another item within the
    // menu (ArrowDown/ArrowUp/Home/End via focusItem) — not an exit, do not close.
    setOpen(false); // no refocusButton (Req 15) — event.relatedTarget is already wherever focus
    // really landed (the real next/previous tab stop for Tab/Shift+Tab, or wherever else focus went)
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (!isOpen()) return;
    const target = event.target as Node;
    if (button.contains(target) || menu.contains(target)) return;
    setOpen(false);
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      setOpen(false, { refocusButton: true });
    }
  }

  updateRovingTabindex(0);

  button.addEventListener('click', handleButtonClick);
  button.addEventListener('keydown', handleButtonKeydown);
  menuItems.forEach((item) => {
    item.addEventListener('click', handleItemClick);
    item.addEventListener('keydown', handleItemKeydown);
  });
  menu.addEventListener('focusout', handleMenuFocusOut);
  doc.addEventListener('click', handleDocumentClick);
  doc.addEventListener('keydown', handleDocumentKeydown);

  return () => {
    button.removeEventListener('click', handleButtonClick);
    button.removeEventListener('keydown', handleButtonKeydown);
    menuItems.forEach((item) => {
      item.removeEventListener('click', handleItemClick);
      item.removeEventListener('keydown', handleItemKeydown);
    });
    menu.removeEventListener('focusout', handleMenuFocusOut);
    doc.removeEventListener('click', handleDocumentClick);
    doc.removeEventListener('keydown', handleDocumentKeydown);
  };
}
