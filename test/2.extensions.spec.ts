import path from 'path';
import { launch } from '../src';
import type { Browser } from '../src';

interface PluginTestsDirect {
  describe: string;
  tests: PluginTestsDirect[] | ((browser: Browser) => Promise<void>)[];
}

function runRecursiveTestsDirect(x: PluginTestsDirect) {
  if (!x.describe || !x.tests) return;

  describe(x.describe, () => {
    for (const test of x.tests) {
      if (typeof test === 'function') {
        it('on browser context', { timeout: 20_000 }, async () => {
          const browser = await launch({ args: ['--no-sandbox'] });
          try {
            await test(browser);
          } finally {
            await browser.close();
          }
        });
      } else {
        runRecursiveTestsDirect(test);
      }
    }
  });
}

const waitAndClickTest = async (browser: Browser) => {
  const page = await browser.newPage();
  expect(page.waitAndClick).toBeDefined();
};

const waitAndTypeTest = async (browser: Browser) => {
  const page = await browser.newPage();
  expect(page.waitAndType).toBeDefined();
};

const withLoaderTest = async (browser: Browser) => {
  const page = await browser.newPage();
  expect(page.withLoader).toBeDefined();

  const filePath = path.resolve('./test/html/withLoader.html');
  await page.goto(`file://${filePath}`);

  await page.withLoader(
    () => page.click('#load-btn'),
    '#loader'
  );

  expect(await page.$('#result').then(x => x?.isVisible())).toBe(true);
  expect(await page.$('#loader').then(x => x?.isVisible())).toBe(false);
};

const pageTests: PluginTestsDirect = {
  describe: 'PuppeteerPro\'s Page',
  tests: [{
    describe: 'can waitAndClick',
    tests: [waitAndClickTest],
  }, {
    describe: 'can waitAndType',
    tests: [waitAndTypeTest],
  }, {
    describe: 'can withLoader',
    tests: [withLoaderTest],
  }],
};

runRecursiveTestsDirect(pageTests);
