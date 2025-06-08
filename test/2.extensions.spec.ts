import * as Puppeteer from 'puppeteer';
import * as PuppeteerPro from '../src';
import { Browser, BrowserContext } from '../src';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

class TestPlugin extends PuppeteerPro.Plugin {
  _state = false;

  async afterLaunch(browser: Puppeteer.Browser | Puppeteer.BrowserContext) {
    const _newPage = browser.newPage;
    browser.newPage = async () => {
      const page = await _newPage.apply(browser);
      await sleep(100); // Sleep to allow user agent to set
      return page;
    };
  }

  async onPageCreated() { this.state = true; }

  get state() { return this._state; }
  set state(state) { this._state = state; }
}

const waitAndClickTest = () => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
  const browser = await createBrowser();

  try {
    const page = await browser.newPage();

    expect(page.waitAndClick).toBeDefined();
  } finally {
    if (browser) await browser.close();
  }
};

const waitAndTypeTest = () => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
  const browser = await createBrowser();

  try {
    const page = await browser.newPage();

    expect(page.waitAndType).toBeDefined();
  } finally {
    if (browser) await browser.close();
  }
};

const pluginTests: PluginTests = {
  describe: 'PuppeteerPro\'s Page',
  tests: [{
    describe: 'can waitAndClick',
    tests: [waitAndClickTest],
  }, {
    describe: 'can waitAndType',
    tests: [waitAndTypeTest],
  }],
};

const runRecursiveTests = (x: PluginTests) => {
  if (x.describe && x.tests) {
    let performTest: (createBrowser: () => Promise<Browser | BrowserContext>) => Promise<void>;

    describe(x.describe, () => {
      for (const test of x.tests) {
        if (test instanceof Function) {
          let browser: Browser | undefined;

          beforeEach(async () => {
            const plugin = new TestPlugin();
            performTest = test(plugin);
          });

          afterEach(async () => {
            await browser?.close();
            browser = undefined;
          });

          it('on browser launch', async () => {
            await performTest(() => PuppeteerPro.launch({ args: ['--no-sandbox'] }));
          });

          it('on browser connect', async () => {
            const browser = await Puppeteer.launch({ args: ['--no-sandbox'] });
            const browserWSEndpoint = browser.wsEndpoint();
            await browser.disconnect();

            await performTest(() => PuppeteerPro.connect({ browserWSEndpoint }));
          });

          it('on browser context', async () => {
            browser = await PuppeteerPro.launch({ args: ['--no-sandbox'] });

            await performTest(() => browser!.createBrowserContext());
          });
        } else {
          runRecursiveTests(test);
        }
      }
    });
  }
};

runRecursiveTests(pluginTests);

interface PluginTests {
  describe: string;
  tests: PluginTests[] | ((plugin: TestPlugin) => (createBrowser: () => Promise<Browser | BrowserContext>) => Promise<void>)[];
}
