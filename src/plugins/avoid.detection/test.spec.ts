import { Browser, BrowserContext } from '../..';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export async function avoidDetectionTest(createBrowser: () => Promise<Browser | BrowserContext>) {
  const browser = await createBrowser();

  const plugin = await browser.avoidDetection({ fingerprintOptions: { devices: ['mobile'], slim: true } });

  let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

  try {
    const getResult = async () => {
      page = await browser.newPage();

      try {
        await page.goto('https://bot.sannysoft.com');
        await sleep(1000);

        // Disable hairline as it seems there is a race condition. Test results keep changing after every run even though the detection is running.
        return await page.evaluate(() => !document.querySelector<HTMLSpanElement>('#user-agent-result')?.innerText.includes('HeadlessChrome'));
      } catch (_ex) {
        return false;
      } finally {
        await page?.close();
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
}
