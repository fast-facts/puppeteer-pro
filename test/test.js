/* eslint-disable semi */
const Puppeteer = require('puppeteer');
const PuppeteerPro = require('../dist/index');
const chai = require('chai');
const fs = require('fs');

const expect = chai.expect;

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };
const waitUntil = async func => { while (!func()) await sleep(200); };

describe('Original methods', () => {
  ['connect', 'defaultArgs', 'executablePath', 'launch', 'createBrowserFetcher'].map(x => {
    it(`should have ${x}`, () => {
      expect(PuppeteerPro[x]).to.be.not.undefined;
    });
  });
});

const anonymizeTest = plugin => async browser => {
  let page;

  try {
    browser = browser || await PuppeteerPro.launch();
    page = await browser.newPage();

    const getResult = async () => {
      await page.goto('https://httpbin.org/headers');
      await sleep(100);

      const data = await page.evaluate(() => JSON.parse(document.body.innerText));
      return data.headers['User-Agent'];
    };

    expect(await getResult()).to.not.contain('Headless');

    await plugin.stop();
    expect(await getResult()).to.contain('Headless');

    await plugin.restart();
    expect(await getResult()).to.not.contain('Headless');
  }
  finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

const avoidDetectionTest = plugin => async browser => {
  let page;

  try {
    browser = browser || await PuppeteerPro.launch();
    page = await browser.newPage();

    const getResult = async () => {
      try {
        await page.goto('https://bot.sannysoft.com');
        await sleep(1000);

        await page.screenshot({ path: `./page1.png` });

        return await page.evaluate(() => document.querySelector('table').querySelectorAll('.failed').length === 0);
      }
      catch (ex) {
        return false;
      }
    };

    expect(await getResult()).to.be.true;

    await plugin.stop();
    expect(await getResult()).to.be.false;

    await plugin.restart();
    expect(await getResult()).to.be.true;
  }
  finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

const blockResourcesTest = plugin => async browser => {
  let page;

  try {
    browser = browser || await PuppeteerPro.launch();
    page = await browser.newPage();

    const getResult = async () => {
      try {
        await page.goto('http://www.google.com');
        return false;
      }
      catch (ex) {
        return true;
      }
    };

    expect(await getResult()).to.be.true;

    await plugin.stop();
    expect(await getResult()).to.be.false;

    await plugin.restart();
    expect(await getResult()).to.be.true;
  }
  finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

const disableDialogsTest = plugin => async browser => {
  let page;

  try {
    browser = browser || await PuppeteerPro.launch();
    page = await browser.newPage();

    const getResult = async () => {
      let result = true;

      page.once('dialog', async dialog => {
        await sleep(100);
        if (!dialog._handled) {
          result = false;
          await dialog.dismiss();
        }
      });

      await page.evaluate(() => alert('1'));

      return result;
    };

    expect(await getResult()).to.be.true;

    await plugin.stop();
    expect(await getResult()).to.be.false;

    await plugin.restart();
    expect(await getResult()).to.be.true;
  }
  finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

const manageCookieTest = mode => plugin => async browser => {
  let page;

  try {
    browser = browser || await PuppeteerPro.launch();
    page = await browser.newPage();
    await page.goto('http://www.google.com');
    await plugin.clear();

    const getCookies = () => {
      if (fs.existsSync('cookies.json')) {
        const cookies = JSON.parse(fs.readFileSync('cookies.json').toString());
        return cookies.filter(x => x.name.startsWith('TestCookie.')).length;
      } else {
        return 0;
      }
    }

    const getResult = async () => {
      if (mode === 'manual') {
        await plugin.load();
        await page.evaluate(() => document.cookie = `TestCookie.${Math.random()}=${Math.random()}`);
        await plugin.save();
      } else if (mode === 'monitor') {
        await page.evaluate(() => document.cookie = `TestCookie.${Math.random()}=${Math.random()}`);
        await sleep(500);
      }

      return getCookies();
    };

    expect(await getResult()).to.equal(1);

    await plugin.stop();
    expect(await getResult()).to.equal(1);

    await plugin.restart();
    expect(await getResult()).to.equal(3);

    await plugin.clear();
    await plugin.stop();
    expect(await getResult()).to.equal(0);
  }
  finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

const pluginTests = {
  describe: 'PuppeteerPro',
  tests: [{
    describe: 'can anonymize user agent',
    tests: [{ testFn: () => anonymizeTest(PuppeteerPro.anonymizeUserAgent()) }]
  },
  {
    describe: 'can avoid detection',
    tests: [{ testFn: () => avoidDetectionTest(PuppeteerPro.avoidDetection()) }]
  },
  {
    describe: 'can block resources',
    tests: [{ testFn: () => blockResourcesTest(PuppeteerPro.blockResources('document')) }]
  },
  {
    describe: 'can disable dialogs',
    tests: [{ testFn: () => disableDialogsTest(PuppeteerPro.disableDialogs()) }]
  },
  {
    describe: 'can manage cookies',
    tests: [{
      describe: 'in manual mode',
      tests: [{ testFn: () => manageCookieTest('manual')(PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'manual', disableWarning: true })) }]
    }, {
      describe: 'in monitor mode',
      tests: [{ testFn: () => manageCookieTest('monitor')(PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'monitor', disableWarning: true })) }]
    }]
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

            PuppeteerPro.clearPlugins();
            performTest = test.testFn();
          });

          after(() => { testsFinished++ });

          it('on browser launch', async () => {
            await performTest();
          });

          it('on browser connect', async () => {
            const browser = await Puppeteer.launch();
            const browserWSEndpoint = browser.wsEndpoint();
            browser.disconnect();

            await performTest(await PuppeteerPro.connect({ browserWSEndpoint }));
          });
        }
      });

    });
  }
};

runRecursiveTests(pluginTests);