const Puppeteer = require('puppeteer');
const PuppeteerPro = require('../dist/index');
const chai = require('chai');

const expect = chai.expect;

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };
const waitUntil = async func => { while (!func()) await sleep(200); };

class TestPlugin extends PuppeteerPro.Plugin {
  constructor() { super(arguments); this.state = false; }
  onPageCreated() { this.state = true; }
  get state() { return this._state; }
  set state(state) { this._state = state; }
}

const addPluginTest = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

  try {
    const getResult = async () => {
      const page = await browser.newPage();
      await sleep(200);

      const works = plugin.state;
      plugin.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).to.equal(true);
  }
  finally {
    if (browser) await browser.close();
  }
};

const stopPluginTest = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

  try {
    const getResult = async () => {
      const page = await browser.newPage();
      await sleep(200);

      const works = plugin.state;
      plugin.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).to.equal(true);

    await plugin.stop();
    expect(await getResult()).to.equal(false);
  }
  finally {
    if (browser) await browser.close();
  }
};

const restartPluginTest = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

  try {
    const getResult = async () => {
      const page = await browser.newPage();
      await sleep(200);

      const works = plugin.state;
      plugin.state = false;

      await page.close();
      return works;
    };

    expect(await getResult()).to.equal(true);

    await plugin.stop();
    expect(await getResult()).to.equal(false);

    await plugin.restart();
    expect(await getResult()).to.equal(true);
  }
  finally {
    if (browser) await browser.close();
  }
};

const pluginTests = {
  describe: 'PuppeteerPro',
  tests: [{
    describe: 'can add plugins',
    tests: [addPluginTest]
  },
  {
    describe: 'can stop plugins',
    tests: [stopPluginTest]
  },
  {
    describe: 'can restart plugins',
    tests: [restartPluginTest]
  }]
};

const runRecursiveTests = x => {
  if (x.describe && x.tests) {
    let performTest;
    let testsFinished = 0;

    describe(x.describe, () => {

      x.tests.forEach((test, i) => {
        if (test.describe) {
          return runRecursiveTests(test);
        } else {
          before(async () => {
            await waitUntil(() => testsFinished === i);
          });

          after(() => { testsFinished++; });

          beforeEach(() => {
            PuppeteerPro.clearPlugins();
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
            browser.disconnect();

            await performTest(browserWSEndpoint);
          });
        }
      });

    });
  }
};

runRecursiveTests(pluginTests);
