import * as Puppeteer from 'puppeteer';

import { connect, launch } from '../src';
import type { Browser, BrowserContext } from '../src';
import { Plugin } from '../src/plugins';

const sleep = (time: number) => new Promise(resolve => { setTimeout(resolve, time); });

class TestPlugin extends Plugin {
  _state = false;

  async afterLaunch(browser: Puppeteer.Browser | Puppeteer.BrowserContext) {
    const _newPage = browser.newPage;
    browser.newPage = async () => {
      const page = await _newPage.apply(browser);
      await sleep(100);
      return page;
    };
  }

  async onPageCreated() { this.state = true; }

  get state() { return this._state; }
  set state(state) { this._state = state; }
}

type TestTarget = Browser | BrowserContext;

interface PluginTests {
  describe: string;
  tests: PluginTests[] | ((plugin: TestPlugin) => (browser: TestTarget) => Promise<void>)[];
}

function runRecursiveTests(x: PluginTests) {
  if (!x.describe || !x.tests) return;

  describe(x.describe, () => {
    for (const test of x.tests) {
      if (typeof test === 'function') {
        it('on browser launch', { timeout: 20_000 }, async () => {
          const plugin = new TestPlugin();
          const performTest = test(plugin);
          const browser = await launch({ args: ['--no-sandbox'] }) as Browser;
          try {
            await performTest(browser);
          } finally {
            await browser.close();
          }
        });

        it('on browser connect', { timeout: 20_000 }, async () => {
          const ppBrowser = await Puppeteer.launch({ args: ['--no-sandbox'] });
          const browserWSEndpoint = ppBrowser.wsEndpoint();
          await ppBrowser.disconnect();

          const plugin = new TestPlugin();
          const performTest = test(plugin);
          const browser = await connect({ browserWSEndpoint }) as Browser;
          try {
            await performTest(browser);
          } finally {
            await browser.close();
          }
        });

        it('on browser context', { timeout: 20_000 }, async () => {
          const rootBrowser = await launch({ args: ['--no-sandbox'] }) as Browser;
          const plugin = new TestPlugin();
          const performTest = test(plugin);
          const browser = await rootBrowser.createBrowserContext() as BrowserContext;
          try {
            await performTest(browser);
          } finally {
            await browser.close();
            await rootBrowser.close();
          }
        });
      } else {
        runRecursiveTests(test);
      }
    }
  });
}

async function getResult(browser: TestTarget, plugin: TestPlugin) {
  const page = await browser.newPage();
  const works = plugin.state;
  plugin.state = false;
  await page.close();
  return works;
}

const hooksPageEvents = (plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();
  await browser.addPlugin(plugin);
  expect(await getResult(browser, plugin)).toBe(true);
};

const stopIgnoresPageEvents = (plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();
  await browser.addPlugin(plugin);
  expect(await getResult(browser, plugin)).toBe(true);

  await plugin.stop();
  expect(await getResult(browser, plugin)).toBe(false);
};

const restartResumesPageEvents = (plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();
  await browser.addPlugin(plugin);
  expect(await getResult(browser, plugin)).toBe(true);

  await plugin.stop();
  expect(await getResult(browser, plugin)).toBe(false);

  await plugin.restart();
  expect(await getResult(browser, plugin)).toBe(true);
};

const cascadesToDependencies = (plugin: TestPlugin) => async (browser: TestTarget) => {
  const dependency = new TestPlugin();
  await plugin.addDependency(dependency);

  await browser.clearPlugins();
  await browser.addPlugin(plugin);

  const checkBoth = async () => {
    const page = await browser.newPage();
    const works = plugin.state && dependency.state;
    plugin.state = false;
    dependency.state = false;
    await page.close();
    return works;
  };

  expect(await checkBoth()).toBe(true);

  await plugin.stop();
  expect(await checkBoth()).toBe(false);

  await plugin.restart();
  expect(await checkBoth()).toBe(true);
};

const clearPluginsStopsAndDrops = (_plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();

  let stopped = false;
  const p = new class extends Plugin {
    async afterStop() { stopped = true; }
  }();

  await browser.addPlugin(p);
  expect(p.isStopped).toBe(false);

  await browser.clearPlugins();
  expect(stopped).toBe(true);
  expect(browser.plugins.length).toBe(0);
  expect(p.isInitialized).toBe(false);

  await browser.addPlugin(p);
  expect(p.isInitialized).toBe(true);
};

const stopTwiceOnce = (_plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();

  let stopCount = 0;
  const p = new class extends Plugin {
    async afterStop() { stopCount++; }
  }();

  await browser.addPlugin(p);

  await p.stop();
  expect(stopCount).toBe(1);
  expect(p.isStopped).toBe(true);

  await p.stop();
  expect(stopCount).toBe(1);
  expect(p.isStopped).toBe(true);
};

const addPluginOnce = (_plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();

  const p = new class extends Plugin { }();
  await browser.addPlugin(p);
  await browser.addPlugin(p);
  expect(browser.plugins.length).toBe(1);
};

const restartWhileRunningNoOp = (_plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();

  let restartCount = 0;
  const p = new class extends Plugin {
    async afterRestart() { restartCount++; }
  }();

  await browser.addPlugin(p);
  expect(p.isStopped).toBe(false);

  await p.restart();
  expect(restartCount).toBe(0);
  expect(p.isStopped).toBe(false);

  await p.stop();
  expect(p.isStopped).toBe(true);

  await p.restart();
  expect(restartCount).toBe(1);
  expect(p.isStopped).toBe(false);
};

const restartAfterRemoveNoOp = (_plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();

  let restartCount = 0;
  let pages = 0;
  const p = new class extends Plugin {
    async afterRestart() { restartCount++; }
    async onPageCreated() { pages++; }
  }();

  await browser.addPlugin(p);
  await browser.clearPlugins();

  await p.restart();
  expect(restartCount).toBe(0);
  expect(p.isStopped).toBe(true);
  expect(p.isInitialized).toBe(false);

  const page = await browser.newPage();
  await page.close();
  expect(pages).toBe(0);
};

const throwingRequestHandlerContinues = (_plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();

  const p = new class extends Plugin {
    requiresInterception = true;
    async processRequest() { throw new Error('handler boom'); }
  }();

  await browser.addPlugin(p);

  const page = await browser.newPage();
  try {
    const response = await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    expect(response?.ok()).toBe(true);
  } finally {
    await page.close();
  }
};

const pluginTests: PluginTests = {
  describe: 'PuppeteerPro',
  tests: [
    { describe: 'addPlugin hooks page events', tests: [hooksPageEvents] },
    { describe: 'addPlugin ignores duplicate instance', tests: [addPluginOnce] },
    { describe: 'stop ignores page events', tests: [stopIgnoresPageEvents] },
    { describe: 'restart after stop resumes page events', tests: [restartResumesPageEvents] },
    { describe: 'stop/restart cascades to dependencies', tests: [cascadesToDependencies] },
    { describe: 'clearPlugins stops and drops plugins', tests: [clearPluginsStopsAndDrops] },
    { describe: 'stop twice only runs afterStop once', tests: [stopTwiceOnce] },
    { describe: 'restart while running does nothing', tests: [restartWhileRunningNoOp] },
    { describe: 'restart after remove does nothing', tests: [restartAfterRemoveNoOp] },
    { describe: 'throwing request handler continues request', tests: [throwingRequestHandlerContinues] },
  ],
};

runRecursiveTests(pluginTests);
