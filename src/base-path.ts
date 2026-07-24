export function getBasePath(env: Record<string, string | undefined> = process.env): string {
  return env.GITHUB_PAGES === 'true' ? '/throughline/' : '/';
}
