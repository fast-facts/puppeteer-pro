import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Browser, BrowserContext } from '../..';
import { ManageLocalStorageOption } from '.';

const sleep = (time: number) => new Promise(resolve => setTimeout(resolve, time));

type LocalStorage = Record<string, Record<string, string>>;

function tmpFile() {
  return path.join(os.tmpdir(), `localStorage-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function readLocalStorage(file: string, profile = 'default'): Record<string, Record<string, string>> {
  if (!fs.existsSync(file)) return {};
  try {
    const data: Record<string, LocalStorage> = JSON.parse(fs.readFileSync(file).toString() || '{}');
    return data[profile] || {};
  } catch { return {}; }
}

async function waitForLocalStorage(file: string, profile: string, origin: string, prefix: string, minCount: number, timeout = 4000): Promise<number> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const storage = readLocalStorage(file, profile);
    const keys = Object.keys(storage[origin] || {});
    if (keys.filter(x => x.startsWith(prefix)).length >= minCount) {
      return minCount;
    }
    await sleep(100);
  }
  const storage = readLocalStorage(file, profile);
  return Object.keys(storage[origin] || {}).filter(x => x.startsWith(prefix)).length;
}

export const manageLocalStorageTest = {
  modes: (mode: string, opts: ManageLocalStorageOption) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();
    const file = tmpFile();
    const pluginOpts = { ...opts, saveLocation: file };
    const plugin = await browser.manageLocalStorage(pluginOpts);

    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      const origin = await page.evaluate(() => window.origin);

      const setAndCount = async (name: string) => {
        if (!page) throw new Error('page not initialized');
        await page.evaluate((n: string) => localStorage.setItem(n, Math.random() + ''), name);
        if (mode === 'manual') {
          await plugin.save();
          return Object.keys(readLocalStorage(file)[origin] || {}).filter(x => x.startsWith('TestStorage.')).length;
        }
        return waitForLocalStorage(file, 'default', origin, 'TestStorage.', name === 'TestStorage.1' ? 1 : 2);
      };

      expect(await setAndCount('TestStorage.1')).toBe(1);

      await plugin.stop();
      expect(Object.keys(readLocalStorage(file)[origin] || {}).filter(x => x.startsWith('TestStorage.')).length).toBe(1);

      await plugin.restart();
      expect(await setAndCount('TestStorage.2')).toBe(2);

      await plugin.clear();
      await plugin.stop();
      expect(Object.keys(readLocalStorage(file)[origin] || {}).filter(x => x.startsWith('TestStorage.')).length).toBe(0);
    } finally {
      await page?.close();
      await browser?.close();
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  },
  clearWithoutPages: () => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();
    const file = tmpFile();
    const plugin = await browser.manageLocalStorage({ saveLocation: file, mode: 'manual', disableWarning: true });

    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');
      const origin = await page.evaluate(() => window.origin);
      await page.evaluate(() => localStorage.setItem('TestKey', 'x'));
      await plugin.save();
      await page.close();
      page = undefined;

      expect(Object.keys(readLocalStorage(file)[origin] || {}).length).toBeGreaterThanOrEqual(1);

      await plugin.clear();
      expect(readLocalStorage(file)[origin]).toBeUndefined();
    } finally {
      await page?.close();
      await browser?.close();
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  },
  profiles: (opts: ManageLocalStorageOption) => async (createBrowser: () => Promise<Browser | BrowserContext>) => {
    const browser = await createBrowser();
    const file = tmpFile();
    const pluginOpts = { ...opts, saveLocation: file };
    const plugin = await browser.manageLocalStorage(pluginOpts);

    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      page = await browser.newPage();
      await page.goto('http://www.google.com');

      const origin = await page.evaluate(() => window.origin);

      for (const profile of ['Profile1', 'Profile2']) {
        await plugin.switchToProfile(profile);
        await page.evaluate((p: string) => localStorage.setItem(p, Math.random() + ''), profile);
        await plugin.save();
      }

      expect(Object.keys(readLocalStorage(file, 'Profile1')[origin] || {}).filter(x => x.startsWith('Profile1')).length).toBe(1);
      expect(Object.keys(readLocalStorage(file, 'Profile2')[origin] || {}).filter(x => x.startsWith('Profile1')).length).toBe(0);
      expect(Object.keys(readLocalStorage(file, 'Profile1')[origin] || {}).filter(x => x.startsWith('Profile2')).length).toBe(0);
      expect(Object.keys(readLocalStorage(file, 'Profile2')[origin] || {}).filter(x => x.startsWith('Profile2')).length).toBe(1);
    } finally {
      await page?.close();
      await browser?.close();
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  },
};
