// Puppeteer Defaults
import * as Puppeteer from 'puppeteer';

import type { Page } from '..';

export function newPage(oldPage: Puppeteer.Page): Page {
  const page = oldPage as Page;

  page.waitAndClick = async (selector: string, waitOptions?: Puppeteer.WaitForSelectorOptions, clickOptions?: Readonly<Puppeteer.ClickOptions>): Promise<void> => {
    await page.waitForSelector(selector, waitOptions);
    await page.click(selector, clickOptions);
  };

  page.waitAndType = async (selector: string, text: string, waitOptions?: Puppeteer.WaitForSelectorOptions, typeOptions?: Readonly<Puppeteer.KeyboardTypeOptions>): Promise<void> => {
    await page.waitForSelector(selector, waitOptions);
    await page.type(selector, text, typeOptions);
  };

  page.withLoader = async<T>(fn: () => Promise<T>, loadingSelector: string, visibleWaitOptions?: Puppeteer.WaitForSelectorOptions, hiddenWaitOptions?: Puppeteer.WaitForSelectorOptions): Promise<T> => {
    const loadingVisible = page.waitForSelector(loadingSelector, visibleWaitOptions);
    const retPromise = Promise.resolve().then(fn);

    try {
      const [, ret] = await Promise.all([loadingVisible, retPromise]);
      await page.waitForSelector(loadingSelector, hiddenWaitOptions || { hidden: true });
      return ret;
    } catch (err) {
      await retPromise.catch(() => undefined);
      throw err;
    }
  };

  return page;
}

export interface Dialog extends Puppeteer.Dialog {
  handled: boolean;
}
