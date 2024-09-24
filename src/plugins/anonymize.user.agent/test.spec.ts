import * as PuppeteerPro from '../../index';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export function anonymizeTest(plugin: PuppeteerPro.Plugin) {
  return async (browserWSEndpoint?: string) => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();

      const getResult = async () => {
        if (!page) return;

        await page.goto('https://postman-echo.com/headers');
        await sleep(100);

        const data = await page.evaluate(() => JSON.parse(document.body.innerText));
        return data.headers['user-agent'];
      };

      expect(await getResult()).not.toContain('Headless');

      await plugin.stop();
      expect(await getResult()).toContain('Headless');

      await plugin.restart();
      expect(await getResult()).not.toContain('Headless');
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  };
}
