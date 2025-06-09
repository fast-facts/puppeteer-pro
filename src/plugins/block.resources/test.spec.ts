import { HTTPRequest } from 'puppeteer';
import { Browser, BrowserContext, Plugin } from '../..';
import { Resource } from '.';

class AbortPlugin extends Plugin {
  constructor() {
    super();
    this.requiresInterception = true;
  }

  async processRequest(request: HTTPRequest) {
    await request.continue();
  }
}

// Test multiple request handlers at once
export function blockResourcesTest(...resources: Resource[]) {
  return async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();

    await browser.addPlugin(new AbortPlugin());
    const plugin = await browser.blockResources(...resources);

    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();

      const getResult = async () => {
        if (!page) return;

        try {
          await page.goto('http://www.google.com');
          return false;
        } catch (_ex) {
          return true;
        }
      };

      expect(await getResult()).toBe(true);

      await plugin.stop();
      expect(await getResult()).toBe(false);

      await plugin.restart();
      expect(await getResult()).toBe(true);
    } finally {
      await page?.close();
      await browser?.close();
    }
  };
}
