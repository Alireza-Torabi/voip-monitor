import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../src/App.js';

describe('language foundation', () => {
  it('renders the English shell left to right', () => {
    const html = renderToStaticMarkup(<App initialLanguage="en" />);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Application foundation');
  });

  it('renders the Persian shell right to left', () => {
    const html = renderToStaticMarkup(<App initialLanguage="fa" />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('زیرساخت برنامه');
  });
});
