/* eslint-disable semi */
const Puppeteer = require('puppeteer');
const PuppeteerPro = require('../dist/index');
const chai = require('chai');

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

describe('PuppeteerPro', () => {
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
          await sleep(100);

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
          return true;
        }
        catch (ex) {
          return false;
        }
      };

      expect(await getResult()).to.be.false;

      await plugin.stop();
      expect(await getResult()).to.be.true;

      await plugin.restart();
      expect(await getResult()).to.be.false;
    }
    finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  };

  const plugins = [
    { describe: 'can anonymize user agent', method: 'anonymizeUserAgent', args: [], test: anonymizeTest },
    { describe: 'can avoid detection', method: 'avoidDetection', args: [], test: avoidDetectionTest },
    { describe: 'can block resources', method: 'blockResources', args: ['document'], test: blockResourcesTest }
  ];

  let numFinished = 0;

  plugins.forEach((plugin, i) => {
    let performTest;

    describe(plugin.describe, () => {
      before(async () => {
        await waitUntil(() => numFinished === i);

        PuppeteerPro.clearPlugins();
        performTest = plugin.test(PuppeteerPro[plugin.method].apply(PuppeteerPro, plugin.args));
      });
      after(function () { numFinished++; });

      it('on launch', async () => {
        await performTest();
      });

      it('on connect', async () => {
        const browser = await Puppeteer.launch();
        const browserWSEndpoint = browser.wsEndpoint();
        browser.disconnect();

        await performTest(await PuppeteerPro.connect({ browserWSEndpoint }));
      });
    });
  });
});
