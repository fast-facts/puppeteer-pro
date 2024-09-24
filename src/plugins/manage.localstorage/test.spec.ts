import * as PuppeteerPro from '../../index';
import * as fs from 'fs';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

type ManageLocalStoragePlugin = ReturnType<typeof PuppeteerPro.manageLocalStorage>;

export const manageLocalStorageTest = {
  modes: (mode: string) => (plugin: ManageLocalStoragePlugin) => async (browserWSEndpoint?: string) => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      const getResult = async () => {
        if (!page) return;

        const origin = await page.evaluate(() => window.origin);
        await page.evaluate(() => localStorage.setItem(`Test.${Math.random()}`, Math.random() + ''));

        if (mode === 'manual') {
          await plugin.save();
        } else if (mode === 'monitor') {
          await sleep(500);
        }

        if (fs.existsSync('localStorage.json')) {
          const localStorage: LocalStorage = JSON.parse(fs.readFileSync('localStorage.json').toString() || '{}')['default'] || [];
          return Object.keys(localStorage[origin] || {}).filter(x => x.startsWith('Test.')).length;
        } else {
          return 0;
        }
      };

      expect(await getResult()).toBe(1);

      await plugin.stop();
      expect(await getResult()).toBe(1);

      await plugin.restart();
      expect(await getResult()).toBe(3);

      await plugin.clear();
      await plugin.stop();
      expect(await getResult()).toBe(0);
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();

      fs.unlinkSync('localStorage.json');
    }
  },
  profiles: (plugin: ManageLocalStoragePlugin) => async (browserWSEndpoint?: string) => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch();
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      const origin = await page.evaluate(() => window.origin);

      for (const profile of ['Profile1', 'Profile2']) {
        await plugin.switchToProfile(profile);
        await page.evaluate(profile => localStorage.setItem(profile, Math.random() + ''), profile);
        await plugin.save();
      }

      const getResult = (profile: string, startsWith: string) => {
        if (fs.existsSync('localStorage.json')) {
          const localStorage: LocalStorage = JSON.parse(fs.readFileSync('localStorage.json').toString() || '{}')[profile];
          return Object.keys(localStorage[origin] || {}).filter(x => x.startsWith(startsWith)).length;
        } else {
          return 0;
        }
      };

      expect(await getResult('Profile1', 'Profile1')).toBe(1);
      expect(await getResult('Profile1', 'Profile2')).toBe(0);

      expect(await getResult('Profile2', 'Profile1')).toBe(0);
      expect(await getResult('Profile2', 'Profile2')).toBe(1);
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();

      fs.unlinkSync('localStorage.json');
    }
  },
};

type LocalStorage = Record<string, Record<string, string>>;
