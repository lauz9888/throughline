export function renderApp(root: HTMLElement): HTMLElement {
  const doc = root.ownerDocument;
  const wordmark = doc.createElement('h1');
  wordmark.className = 'wordmark';
  wordmark.textContent = 'throughline';
  root.replaceChildren(wordmark);
  return wordmark;
}
