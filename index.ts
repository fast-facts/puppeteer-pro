import * as PuppeteerPro from './src/index';
import * as fs from 'fs';



const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

// tslint:disable-next-line: no-floating-promises
(async () => {
  await PuppeteerPro.clearPlugins();
  const plugin = PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'manual', disableWarning: true });


  const browser = await PuppeteerPro.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('http://www.google.com');

  await page.evaluate(() => document.cookie = `${Math.random()}=${Math.random()}`);
  await sleep(500);
  await plugin.save();

  console.log(JSON.parse(fs.readFileSync('cookies.json').toString()).length);

})();