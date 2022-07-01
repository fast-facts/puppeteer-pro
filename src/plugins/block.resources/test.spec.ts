import { HTTPRequest } from 'puppeteer';
import * as PuppeteerPro from '../../index';

class AbortPlugin extends PuppeteerPro.Plugin {
  constructor() {
    super();
    this.requiresInterception = true;
  }
  async processRequest(request: HTTPRequest) {
    await request.continue();
  }
}

// Test multiple request handlers at once
export function blockResourcesTest(plugin: PuppeteerPro.Plugin) {
  return async (browserWSEndpoint?: string) => {
    PuppeteerPro.addPlugin(new AbortPlugin());

    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();

      const getResult = async () => {
        if (!page) return;

        try {
          await page.goto('http://www.google.com');
          return false;
        }
        catch (ex) {
          return true;
        }
      };

      expect(await getResult()).toBe(true);

      await plugin.stop();
      expect(await getResult()).toBe(false);

      await plugin.restart();
      expect(await getResult()).toBe(true);
    }
    finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  };
}