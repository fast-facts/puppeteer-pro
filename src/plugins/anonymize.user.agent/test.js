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