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