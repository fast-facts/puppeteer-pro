const PuppeteerPro = require('../../../dist/index');
const chai = require('chai');
const fs = require('fs');

const expect = chai.expect;

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };

module.exports = {
  modes: mode => plugin => async browserWSEndpoint => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
    let page;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      const getResult = async () => {
        await page.evaluate(() => document.cookie = `TestCookie.${Math.random()}=${Math.random()}`);

        if (mode === 'manual') {
          await plugin.save();
        } else if (mode === 'monitor') {
          await sleep(500);
        }

        if (fs.existsSync('cookies.json')) {
          const cookies = JSON.parse(fs.readFileSync('cookies.json').toString() || '{}')['default'] || [];
          return cookies.filter(x => x.name.startsWith('TestCookie.')).length;
        } else {
          return 0;
        }
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

      fs.unlinkSync('cookies.json');
    }
  },
  profiles: plugin => async browserWSEndpoint => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
    let page;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      for (const profile of ['Profile1', 'Profile2']) {
        await plugin.switchToProfile(profile);
        await page.evaluate(profile => document.cookie = `${profile}=${Math.random()}`, profile);
        await plugin.save();
      }

      const getResult = (profile, startsWith) => {
        if (fs.existsSync('cookies.json')) {
          const cookies = JSON.parse(fs.readFileSync('cookies.json').toString() || '{}')[profile];
          return cookies.filter(x => x.name.startsWith(startsWith)).length;
        } else {
          return 0;
        }
      };

      expect(await getResult('Profile1', 'Profile1')).to.equal(1);
      expect(await getResult('Profile1', 'Profile2')).to.equal(0);

      expect(await getResult('Profile2', 'Profile1')).to.equal(0);
      expect(await getResult('Profile2', 'Profile2')).to.equal(1);
    }
    finally {
      if (page) await page.close();
      if (browser) await browser.close();

      fs.unlinkSync('cookies.json');
    }
  }
};