import type { StorybookConfig } from '@storybook/html-vite';
import type { PluginOption } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: { name: '@storybook/html-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: async (viteConfig) => {
    // `storybook dev` / `storybook build` auto-load the project's root
    // vite.config.ts, which registers VitePWA. That plugin would try to
    // precache Storybook's own manager bundle and fail the build, and
    // service-worker/manifest generation has no bearing on isolated module
    // stories, so it is stripped. Under `test:storybook` the root config is
    // not auto-merged, so this is a no-op there.
    const shouldStrip = (plugin: unknown): boolean => {
      const name =
        plugin && typeof plugin === 'object' && 'name' in plugin
          ? (plugin as { name?: unknown }).name
          : undefined;
      return typeof name === 'string' && name.startsWith('vite-plugin-pwa');
    };
    const stripDuplicatedPlugins = (plugins: unknown): PluginOption[] =>
      (Array.isArray(plugins) ? plugins : [plugins])
        .filter((plugin) => plugin != null)
        .flatMap((plugin) => (Array.isArray(plugin) ? stripDuplicatedPlugins(plugin) : plugin))
        .filter((plugin) => !shouldStrip(plugin)) as PluginOption[];

    return { ...viteConfig, plugins: stripDuplicatedPlugins(viteConfig.plugins ?? []) };
  },
};

export default config;
