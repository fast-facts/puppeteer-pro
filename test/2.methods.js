const Puppeteer = require('puppeteer');
const PuppeteerPro = require('../dist/index');
const chai = require('chai');

const expect = chai.expect;

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };
const waitUntil = async func => { while (!func()) await sleep(200); };

class TestPlugin extends PuppeteerPro.Plugin {
  constructor() { super(arguments); this.state = false; }
  afterLaunch(browser) {
    const _newPage = browser.newPage;
    browser.newPage = async () => {
      const page = await _newPage.apply(browser);
      await sleep(100); // Sleep to allow user agent to set
      return page;
    };
  }
  onPageCreated() { this.state = true; }
  get state() { return this._state; }
  set state(state) { this._state = state; }
}

const addTest = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

  try {
    const getResult = async () => {
      const page = await browser.newPage();

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

const stopTest = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

  try {
    const getResult = async () => {
      const page = await browser.newPage();

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

const restartTest = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();

  try {
    const getResult = async () => {
      const page = await browser.newPage();

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

const dependencyTest = plugin => async browserWSEndpoint => {
  const dependency = new TestPlugin();
  plugin.addDependency(dependency);

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

const runRecursiveTests = x => {
  if (x.describe && x.tests) {
    let performTest;
    let testsFinished = 0;

    describe(x.describe, () => {

      x.tests.forEach((test, i) => {
        if (test.describe) {
          return runRecursiveTests(test);
        } else {
          before(async () => { await waitUntil(() => testsFinished === i); });
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
