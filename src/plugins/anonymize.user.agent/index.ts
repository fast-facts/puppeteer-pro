// eslint-disable-next-line @typescript-eslint/no-require-imports
import UserAgent = require('user-agents');

import { Browser, BrowserContext, Page, Plugin } from '../..';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

interface PageUserAgent {
  target: Page;
  userAgent: string;
  newUserAgent: string;
}

export class AnonymizeUserAgentPlugin extends Plugin {
  private pages: PageUserAgent[] = [];
  private userAgent?: string;

  constructor() {
    super();

    try {
      this.userAgent = new UserAgent({ vendor: 'Google Inc.', platform: 'Win32' }).toString();
    } catch (_ex) {
      console.warn('Could not create a random user agent');
    }
  }

  protected async afterLaunch(browser: Browser | BrowserContext) {
    const _newPage = browser.newPage;
    browser.newPage = async (): Promise<Page> => {
      const page = await _newPage.apply(browser);
      await sleep(100); // Sleep to allow user agent to set
      return page;
    };
  }

  protected async onClose() {
    this.pages = [];
  }

  protected async onPageCreated(page: Page) {
    const userAgent = await page.browser().userAgent();
    const newUserAgent = this.userAgent || userAgent.replace('HeadlessChrome/', 'Chrome/').replace(/\(([^)]+)\)/, '(Windows NT 10.0; Win64; x64)');

    this.pages.push({ target: page, userAgent, newUserAgent });

    await page.setUserAgent({ userAgent: newUserAgent });
  }

  protected async beforeRestart() {
    for (const page of this.pages) {
      if (page.target.isClosed()) continue;

      await page.target.setUserAgent({ userAgent: page.newUserAgent });
    }
  }

  protected async afterStop() {
    for (const page of this.pages) {
      if (page.target.isClosed()) continue;

      await page.target.setUserAgent({ userAgent: page.userAgent });
    }
  }
}
