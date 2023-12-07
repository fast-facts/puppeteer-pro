import * as Puppeteer from 'puppeteer';
import { Browser } from 'puppeteer';
import * as PuppeteerPro from '../src/index';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

class TestPlugin extends PuppeteerPro.Plugin {
  _state = false;

  async afterLaunch(browser: Browser) {
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

const addTest = (plugin: TestPlugin) => async (browserWSEndpoint?: string) => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

  try {
    const getResult = async () => {
      const page = await browser.newPage();

      const works = plugin.state;
      plugin.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).toBe(true);
  }
  finally {
    if (browser) await browser.close();
  }
};

const stopTest = (plugin: TestPlugin) => async (browserWSEndpoint?: string) => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

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
  }
  finally {
    if (browser) await browser.close();
  }
};

const restartTest = (plugin: TestPlugin) => async (browserWSEndpoint?: string) => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

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
  }
  finally {
    if (browser) await browser.close();
  }
};

const dependencyTest = (plugin: TestPlugin) => async (browserWSEndpoint?: string) => {
  const dependency = new TestPlugin();
  await plugin.addDependency(dependency);

  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

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
  }
  finally {
    if (browser) await browser.close();
  }
};

const pluginTests: PluginTests = {
  describe: 'PuppeteerPro',
  tests: [{
    describe: 'can add a plugin',
    tests: [addTest]
  },
  {
    describe: 'can stop a plugin',
    tests: [stopTest]
  },
  {
    describe: 'can restart a plugin',
    tests: [restartTest]
  },
  {
    describe: 'can have a plugin with dependencies',
    tests: [dependencyTest]
  }]
};

const runRecursiveTests = (x: PluginTests) => {
  if (x.describe && x.tests) {
    let performTest: (browserWSEndpoint?: string) => Promise<void>;

    describe(x.describe, () => {

      for (const test of x.tests) {
        if (test instanceof Function) {
          beforeEach(async () => {
            await PuppeteerPro.clearPlugins();
            const plugin = new TestPlugin();
            PuppeteerPro.addPlugin(plugin);
            performTest = test(plugin);
          });

          it('on browser launch', async () => {
            await performTest();
          });

          it('on browser connect', async () => {
            const browser = await Puppeteer.launch();
            const browserWSEndpoint = browser.wsEndpoint();
            await browser.disconnect();

            await performTest(browserWSEndpoint);
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
  tests: PluginTests[] | ((plugin: TestPlugin) => (browserWSEndpoint?: string) => Promise<void>)[]
}