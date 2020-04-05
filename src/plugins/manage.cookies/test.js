const PuppeteerPro = require('../../../dist/index');
const chai = require('chai');
const fs = require('fs');

const expect = chai.expect;

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };

module.exports = mode => plugin => async browserWSEndpoint => {
  const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
  let page;

  try {
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
    };

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