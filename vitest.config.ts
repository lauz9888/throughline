// vitest.config.ts - the Storybook UI test provider (@storybook/addon-vitest) starts Vitest
// from the default config of the project root and filters for the project
// `storybook:<configDir>`; keep that project reachable here. See ADR 0006.
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

const launchedByStorybook = process.env.VITEST_STORYBOOK === 'true';

export default launchedByStorybook
  ? defineConfig({ test: { projects: ['./vitest.storybook.config.ts'] } })
  : viteConfig;
