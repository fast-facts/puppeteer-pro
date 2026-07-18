import * as PuppeteerPro from '../src';

describe('Original methods', () => {
  ['connect', 'launch'].map(x => {
    it(`should have ${x}`, () => {
      expect(PuppeteerPro).toHaveProperty(x);
    });
  });

  it('should launch and navigate', async () => {
    const browser = await PuppeteerPro.launch({ args: ['--no-sandbox'] });
    expect(browser).toBeDefined();
    expect(browser.newPage).toBeDefined();

    const page = await browser.newPage();
    expect(page).toBeDefined();
    expect(page.goto).toBeDefined();

    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');

    await browser.close();
  });
});
