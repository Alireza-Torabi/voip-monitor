// @vitest-environment jsdom
import { ChakraProvider } from '@chakra-ui/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HelpHint, HelpProvider } from '../src/ContextHelp.js';
import { HELP } from '../src/helpContent.js';
import { nocSystem } from '../src/theme.js';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  class TestResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: TestResizeObserver,
    configurable: true,
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
});

async function renderHelp(language: 'en' | 'fa') {
  await act(async () => {
    root.render(
      <ChakraProvider value={nocSystem}>
        <HelpProvider language={language}>
          <HelpHint help={HELP.reports.uniqueCallers} kind="metric" />
        </HelpProvider>
      </ChakraProvider>,
    );
  });
}

function trigger(): HTMLButtonElement {
  const value = document.querySelector<HTMLButtonElement>('[data-help-trigger]');
  if (!value) throw new Error('help trigger missing');
  return value;
}

describe('context help', () => {
  it('previews on hover, pins on click and closes explicitly', async () => {
    await renderHelp('en');
    const button = trigger();

    await act(async () => {
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Unique callers');
    expect(document.body.textContent).toContain('Why it matters');
    expect(document.body.textContent).toContain('How it is calculated');
    expect(document.body.textContent).toContain('Distinct identified caller IDs');

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 160));
    });
    expect(document.body.textContent).toContain('This help is pinned');

    const close = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.getAttribute('aria-label') === 'Close help',
    );
    expect(close).toBeDefined();
    await act(async () => close?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).not.toContain('This help is pinned');
  });

  it('renders the Persian explanation and calculation in Persian mode', async () => {
    await renderHelp('fa');
    const button = trigger();

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('تماس‌گیرنده یکتا');
    expect(document.body.textContent).toContain('چرا مهم است؟');
    expect(document.body.textContent).toContain('نحوه محاسبه');
    expect(document.body.textContent).toContain('Caller ID یکتای شناسایی‌شده');
    expect(button.getAttribute('aria-label')).toContain('راهنما');
  });
});
