import { Browser, BrowserContext } from 'puppeteer';
import * as PuppeteerPro from '../..';

type ManageCookiesPlugin = ReturnType<typeof PuppeteerPro.solveRecaptchas>;

export function solveRecaptchaTest(plugin: ManageCookiesPlugin) {
  return async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();

      const getResult = async () => {
        if (!page) return;

        await page.goto('https://www.google.com/recaptcha/api2/demo');

        await plugin.solveRecaptcha(page);

        await page.waitForFunction(() => {
          const iframe = document.querySelector<HTMLIFrameElement>('iframe[src*="api2/anchor"]');
          return iframe && iframe.contentDocument && iframe.contentDocument.querySelector('#recaptcha-anchor');
        });

        return page.evaluate(() => {
          const iframe = document.querySelector<HTMLIFrameElement>('iframe[src*="api2/anchor"]');
          return iframe && iframe.contentDocument && iframe.contentDocument.querySelector('.recaptcha-checkbox-checked');
        });
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
