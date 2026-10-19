// Helpers for the page tests. They load a page in jsdom and run its scripts.
import { JSDOM, ResourceLoader, VirtualConsole } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load local scripts only. Skip style sheets and fonts: the tests do not need them.
class LocalScripts extends ResourceLoader {
  fetch(url, options) {
    return url.startsWith('file:') && url.endsWith('.js') ? super.fetch(url, options) : null;
  }
}

export async function loadPage(relPath) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String((e.detail && e.detail.stack) || e.message).split('\n')[0]));
  virtualConsole.on('error', (e) => errors.push(String(e)));
  const dom = await JSDOM.fromFile(join(ROOT, relPath), {
    runScripts: 'dangerously',
    resources: new LocalScripts(),
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { document } = dom.window;
  if (document.readyState !== 'complete') await new Promise((r) => dom.window.addEventListener('load', r));
  return { dom, window: dom.window, document, errors };
}

export function type(window, input, text) {
  input.value = text;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
