import { describe, it, expect } from 'vitest';
import { getBasePath } from './base-path';

describe('getBasePath', () => {
  it('returns "/throughline/" when GITHUB_PAGES is "true"', () => {
    expect(getBasePath({ GITHUB_PAGES: 'true' })).toBe('/throughline/');
  });

  it('returns "/" when GITHUB_PAGES is unset', () => {
    expect(getBasePath({})).toBe('/');
  });

  it('returns "/" when GITHUB_PAGES is "false"', () => {
    expect(getBasePath({ GITHUB_PAGES: 'false' })).toBe('/');
  });
});
