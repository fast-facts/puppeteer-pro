import * as PuppeteerPro from '../../index';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export function avoidDetectionTest(plugin: PuppeteerPro.Plugin) {
  return async (browserWSEndpoint?: string) => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();

      const getResult = async () => {
        if (!page) return;

        try {
          await page.goto('https://bot.sannysoft.com');
          await sleep(1000);

          // Disable hairline as it seems there is a race condition. Test results keep changing after every run even though the detection is running.
          return await page.evaluate(() => document.querySelector('table')?.querySelectorAll('.failed:not(#hairline-feature)').length === 0);
        } catch (_ex) {
          return false;
        }
      };

      expect(await getResult()).toBe(true);

      await plugin.stop();
      expect(await getResult()).toBe(false);

      await plugin.restart();
      expect(await getResult()).toBe(true);
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  };
}
