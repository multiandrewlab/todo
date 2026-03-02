import { describe, it, expect } from 'vitest';
import { parseLinkPreview } from '../../src/services/link-preview.js';

describe('parseLinkPreview', () => {
  it('extracts title and favicon from HTML', () => {
    const html =
      '<html><head><title>Example Page</title><link rel="icon" href="/favicon.ico"></head></html>';
    const result = parseLinkPreview(html, 'https://example.com');
    expect(result.title).toBe('Example Page');
    expect(result.favicon).toBe('https://example.com/favicon.ico');
  });

  it('handles relative favicon paths', () => {
    const html =
      '<html><head><title>Test</title><link rel="shortcut icon" href="img/fav.png"></head></html>';
    const result = parseLinkPreview(html, 'https://example.com/page');
    expect(result.favicon).toBe('https://example.com/img/fav.png');
  });

  it('returns null values for missing elements', () => {
    const result = parseLinkPreview(
      '<html><body>No head</body></html>',
      'https://example.com'
    );
    expect(result.title).toBeNull();
    expect(result.favicon).toBeNull();
  });

  it('handles href before rel attribute order', () => {
    const html =
      '<html><head><title>T</title><link href="/icon.png" rel="icon"></head></html>';
    const result = parseLinkPreview(html, 'https://example.com');
    expect(result.favicon).toBe('https://example.com/icon.png');
  });

  it('extracts title with attributes on tag', () => {
    const html = '<html><head><title lang="en">My Page</title></head></html>';
    const result = parseLinkPreview(html, 'https://example.com');
    expect(result.title).toBe('My Page');
  });
});
