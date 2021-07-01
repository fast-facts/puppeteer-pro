const PuppeteerPro = require('../../../dist/index');
const chai = require('chai');

const expect = chai.expect;

// Test multiple request handlers at once
module.exports = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
  let page;

  try {
    page = await browser.newPage();

    const getResult = async () => {
      await page.goto('https://www.google.com/recaptcha/api2/demo');

      await plugin.solveRecaptcha(page);

      await page.waitForFunction(() => {
        const iframe = document.querySelector('iframe[src*="api2/anchor"]');
        return iframe && iframe.contentDocument && iframe.contentDocument.querySelector('#recaptcha-anchor');
      });

      return await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="api2/anchor"]');
        return !!iframe.contentDocument.querySelector('.recaptcha-checkbox-checked');
      });
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