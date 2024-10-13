import * as PuppeteerPro from '../../index';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export function disableDialogsTest(plugin: PuppeteerPro.Plugin) {
  return async (browserWSEndpoint?: string) => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch({ args: ['--no-sandbox'] });
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();

      const getResult = async () => {
        if (!page) return;

        let result = true;

        page.once('dialog', async dialog => {
          await sleep(100);
          try {
            await dialog.dismiss();
            result = false;
          } catch (_ex) { null; }
        });

        await page.evaluate(() => alert('1'));

        return result;
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
