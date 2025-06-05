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

const addTest = (plugin: TestPlugin) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
  const browser = await createBrowser();

  browser.clearPlugins();
  await browser.addPlugin(plugin);

  try {
    const getResult = async () => {
      const page = await browser.newPage();

      const works = plugin.state;
      plugin.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).toBe(true);
  } finally {
    if (browser) await browser.close();
  }
};

const stopTest = (plugin: TestPlugin) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
  const browser = await createBrowser();

  browser.clearPlugins();
  await browser.addPlugin(plugin);

  try {
    const getResult = async () => {
      const page = await browser.newPage();

      const works = plugin.state;
      plugin.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).toBe(true);

    await plugin.stop();
    expect(await getResult()).toBe(false);
  } finally {
    if (browser) await browser.close();
  }
};

const restartTest = (plugin: TestPlugin) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
  const browser = await createBrowser();

  browser.clearPlugins();
  await browser.addPlugin(plugin);

  try {
    const getResult = async () => {
      const page = await browser.newPage();

      const works = plugin.state;
      plugin.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).toBe(true);

    await plugin.stop();
    expect(await getResult()).toBe(false);

    await plugin.restart();
    expect(await getResult()).toBe(true);
  } finally {
    if (browser) await browser.close();
  }
};

const dependencyTest = (plugin: TestPlugin) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
  const dependency = new TestPlugin();
  await plugin.addDependency(dependency);

  const browser = await createBrowser();

  browser.clearPlugins();
  await browser.addPlugin(plugin);

  try {
    const getResult = async () => {
      const page = await browser.newPage();

      const works = plugin.state && dependency.state;
      plugin.state = false;
      dependency.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).toBe(true);

    await plugin.stop();
    expect(await getResult()).toBe(false);

    await plugin.restart();
    expect(await getResult()).toBe(true);
  } finally {
    if (browser) await browser.close();
  }
};

const pluginTests: PluginTests = {
  describe: 'PuppeteerPro',
  tests: [{
    describe: 'can add a plugin',
    tests: [addTest],
  },
  {
    describe: 'can stop a plugin',
    tests: [stopTest],
  },
  {
    describe: 'can restart a plugin',
    tests: [restartTest],
  },
  {
    describe: 'can have a plugin with dependencies',
    tests: [dependencyTest],
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
