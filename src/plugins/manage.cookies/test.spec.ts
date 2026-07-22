import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Cookie } from 'puppeteer';

import { Browser, BrowserContext } from '../..';
import { ManageCookiesOption } from '.';

const sleep = (time: number) => new Promise(resolve => setTimeout(resolve, time));

function tmpFile() {
  return path.join(os.tmpdir(), `cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function readCookies(file: string, profile = 'default'): Cookie[] {
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file).toString() || '{}');
    return data[profile] || [];
  } catch { return []; }
}

async function waitForCookies(file: string, profile: string, prefix: string, minCount: number, timeout = 4000): Promise<number> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const cookies = readCookies(file, profile);
    if (cookies.filter(x => x.name.startsWith(prefix)).length >= minCount) {
      return minCount;
    }
    await sleep(100);
  }
  return readCookies(file, profile).filter(x => x.name.startsWith(prefix)).length;
}

export const manageCookiesTest = {
  modes: (mode: string, opts: ManageCookiesOption) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();
    const file = tmpFile();
    const pluginOpts = { ...opts, saveLocation: file };
    const plugin = await browser.manageCookies(pluginOpts);

    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      const setAndCount = async (name: string) => {
        if (!page) throw new Error('page not initialized');
        await page.evaluate((n: string) => document.cookie = `${n}=${Math.random()}`, name);
        if (mode === 'manual') {
          await plugin.save();
          return readCookies(file).filter(x => x.name.startsWith('TestCookie.')).length;
        }
        return waitForCookies(file, 'default', 'TestCookie.', name === 'TestCookie.1' ? 1 : 2);
      };

      expect(await setAndCount('TestCookie.1')).toBe(1);

      if (mode === 'monitor') {
        await page!.evaluate(() => document.cookie = 'TestCookie.flush=1');
        await plugin.switchToProfile('other');
        expect(readCookies(file, 'default').some(c => c.name === 'TestCookie.flush')).toBe(true);
        await plugin.switchToProfile('default');
      }

      await plugin.stop();
      expect(readCookies(file).filter(x => x.name.startsWith('TestCookie.')).length).toBeGreaterThanOrEqual(1);

      await plugin.restart();
      expect(await setAndCount('TestCookie.2')).toBe(2);

      await plugin.clear();
      await plugin.stop();
      expect(readCookies(file).filter(x => x.name.startsWith('TestCookie.')).length).toBe(0);
    } finally {
      await page?.close();
      await browser?.close();
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  },
  clearWithoutPages: () => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();
    const file = tmpFile();
    const plugin = await browser.manageCookies({ saveLocation: file, mode: 'manual', disableWarning: true });

    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');
      await page.evaluate(() => document.cookie = 'TestCookie.x=1');
      await plugin.save();
      await page.close();
      page = undefined;

      expect(readCookies(file).length).toBeGreaterThanOrEqual(1);
      await plugin.save();
      expect(readCookies(file).length).toBeGreaterThanOrEqual(1);

      await browser.deleteCookie(...await browser.cookies());
      expect((await browser.cookies()).length).toBe(0);
      await plugin.load();
      expect((await browser.cookies()).some(c => c.name === 'TestCookie.x')).toBe(true);

      await plugin.clear();
      expect(readCookies(file).length).toBe(0);
    } finally {
      await page?.close();
      await browser?.close();
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  },
  profiles: (opts: ManageCookiesOption) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();
    const file = tmpFile();
    const pluginOpts = { ...opts, saveLocation: file };
    const plugin = await browser.manageCookies(pluginOpts);

    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      for (const profile of ['Profile1', 'Profile2']) {
        await plugin.switchToProfile(profile);
        await page.evaluate((p: string) => document.cookie = `${p}=${Math.random()}`, profile);
        await plugin.save();
      }

      expect(readCookies(file, 'Profile1').filter(x => x.name.startsWith('Profile1')).length).toBe(1);
      expect(readCookies(file, 'Profile2').filter(x => x.name.startsWith('Profile1')).length).toBe(0);
      expect(readCookies(file, 'Profile1').filter(x => x.name.startsWith('Profile2')).length).toBe(0);
      expect(readCookies(file, 'Profile2').filter(x => x.name.startsWith('Profile2')).length).toBe(1);
    } finally {
      await page?.close();
      await browser?.close();
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  },
};
