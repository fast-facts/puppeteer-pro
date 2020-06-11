
const PuppeteerPro = require('./dist/index');
PuppeteerPro.avoidDetection();

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };

(async () => {
  const browser = await PuppeteerPro.launch({ headless: true });

  const links = [
    'https://bot.sannysoft.com/',
    'https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html',
    'https://arh.antoinevastel.com/bots/areyouheadless'
  ];

  for (const link of links) {
    const page = await browser.newPage();
    await page.goto(link);
    await sleep(1000);

    const [height, width] = await page.evaluate(() => [
      document.getElementsByTagName('html')[0].offsetHeight,
      document.getElementsByTagName('html')[0].offsetWidth
    ]);

    // console.log(width, height);
    await page.setViewport({ width, height });
    await page.screenshot({ path: `./page${links.indexOf(link) + 1}.png`, clip: { x: 0, y: 0, width, height } });
    await page.close();
  }

  await browser.close();
})();