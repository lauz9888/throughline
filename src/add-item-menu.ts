export interface AddItemMenuElements {
  button: HTMLButtonElement;
  menu: HTMLElement;
  onItemSelect?: (label: string) => void;
}

export function initAddItemMenu({ button, menu, onItemSelect }: AddItemMenuElements): () => void {
  const doc = button.ownerDocument;
  const menuItems = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

  const isOpen = () => button.getAttribute('aria-expanded') === 'true';

  function setOpen(open: boolean, options: { refocusButton?: boolean } = {}): void {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (!open && options.refocusButton) {
      button.focus();
    }
  }

  function handleButtonClick(): void {
    setOpen(!isOpen());
  }

  function handleItemClick(event: MouseEvent): void {
    setOpen(false, { refocusButton: true });
    const item = event.currentTarget as HTMLButtonElement;
    onItemSelect?.(item.textContent ?? '');
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
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const currentIndex = menuItems.indexOf(doc.activeElement as HTMLButtonElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + delta + menuItems.length) % menuItems.length;
      event.preventDefault();
      menuItems[nextIndex]?.focus();
    }
  }

  button.addEventListener('click', handleButtonClick);
  menuItems.forEach((item) => item.addEventListener('click', handleItemClick));
  doc.addEventListener('click', handleDocumentClick);
  doc.addEventListener('keydown', handleDocumentKeydown);

  return () => {
    button.removeEventListener('click', handleButtonClick);
    menuItems.forEach((item) => item.removeEventListener('click', handleItemClick));
    doc.removeEventListener('click', handleDocumentClick);
    doc.removeEventListener('keydown', handleDocumentKeydown);
  };
}
