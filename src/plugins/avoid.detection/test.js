const PuppeteerPro = require('../../../dist/index');
const chai = require('chai');

const expect = chai.expect;

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };

module.exports = plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
  let page;

  try {
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