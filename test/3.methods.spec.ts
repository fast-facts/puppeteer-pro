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

const addTest = (plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();
  await browser.addPlugin(plugin);
  expect(await getResult(browser, plugin)).toBe(true);
};

const stopTest = (plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();
  await browser.addPlugin(plugin);
  expect(await getResult(browser, plugin)).toBe(true);

  await plugin.stop();
  expect(await getResult(browser, plugin)).toBe(false);
};

const restartTest = (plugin: TestPlugin) => async (browser: TestTarget) => {
  await browser.clearPlugins();
  await browser.addPlugin(plugin);
  expect(await getResult(browser, plugin)).toBe(true);

  await plugin.stop();
  expect(await getResult(browser, plugin)).toBe(false);

  await plugin.restart();
  expect(await getResult(browser, plugin)).toBe(true);
};

const dependencyTest = (plugin: TestPlugin) => async (browser: TestTarget) => {
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

const clearPluginsMidlife = (_plugin: TestPlugin) => async (browser: TestTarget) => {
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
};

const doubleStop = (_plugin: TestPlugin) => async (browser: TestTarget) => {
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

  const p = new class extends Plugin {}();
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

const pluginTests: PluginTests = {
  describe: 'PuppeteerPro',
  tests: [
    { describe: 'can add a plugin', tests: [addTest] },
    { describe: 'addPlugin ignores duplicate instance', tests: [addPluginOnce] },
    { describe: 'can stop a plugin', tests: [stopTest] },
    { describe: 'can restart a plugin', tests: [restartTest] },
    { describe: 'can have a plugin with dependencies', tests: [dependencyTest] },
    { describe: 'clearPlugins mid-lifecycle', tests: [clearPluginsMidlife] },
    { describe: 'double stop is safe', tests: [doubleStop] },
    { describe: 'restart while running does nothing', tests: [restartWhileRunningNoOp] },
  ],
};

runRecursiveTests(pluginTests);
