import { Browser, BrowserContext } from '../..';

export async function solveRecaptchasTest(createBrowser: () => Promise<Browser | BrowserContext>) {
  const browser = await createBrowser();

  const plugin = await browser.solveRecaptchas(process.env.WIT_AI_ACCESS_TOKEN as string);

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
}
