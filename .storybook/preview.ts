import type { Preview } from '@storybook/html-vite';
import '../src/style.css';

// Mirrors .claude/STANDARDS.md "WCAG conformance scope" exactly; keep in sync.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const preview: Preview = {
  parameters: {
    a11y: {
      test: 'error',
      options: { runOnly: { type: 'tag', values: WCAG_TAGS } },
    },
  },
};

export default preview;
