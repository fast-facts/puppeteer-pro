import * as PuppeteerPro from '../../index';
import * as fs from 'fs';
import type ProtocolMapping from 'devtools-protocol/types/protocol-mapping';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

type ManageCookiesPlugin = ReturnType<typeof PuppeteerPro.manageCookies>;

export const manageCookiesTest = {
  modes: (mode: string) => (plugin: ManageCookiesPlugin) => async (browserWSEndpoint?: string) => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch({ args: ['--no-sandbox'] });
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      const getResult = async () => {
        if (!page) return;

        await page.evaluate(() => document.cookie = `TestCookie.${Math.random()}=${Math.random()}`);

        if (mode === 'manual') {
          await plugin.save();
        } else if (mode === 'monitor') {
          await sleep(500);
        }

        if (fs.existsSync('cookies.json')) {
          const cookies: Cookie[] = JSON.parse(fs.readFileSync('cookies.json').toString() || '{}')['default'] || [];
          return cookies.filter(x => x.name.startsWith('TestCookie.')).length;
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

      fs.unlinkSync('cookies.json');
    }
  },
  profiles: (plugin: ManageCookiesPlugin) => async (browserWSEndpoint?: string) => {
    const browser = browserWSEndpoint ? await PuppeteerPro.connect({ browserWSEndpoint }) : await PuppeteerPro.launch({ args: ['--no-sandbox'] });
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      for (const profile of ['Profile1', 'Profile2']) {
        await plugin.switchToProfile(profile);
        await page.evaluate(profile => document.cookie = `${profile}=${Math.random()}`, profile);
        await plugin.save();
      }

      const getResult = (profile: string, startsWith: string) => {
        if (fs.existsSync('cookies.json')) {
          const cookies: Cookie[] = JSON.parse(fs.readFileSync('cookies.json').toString() || '{}')[profile];
          return cookies.filter(x => x.name.startsWith(startsWith)).length;
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

      fs.unlinkSync('cookies.json');
    }
  },
};

type Cookie = ProtocolMapping.Commands['Network.getAllCookies']['returnType']['cookies'][number];
