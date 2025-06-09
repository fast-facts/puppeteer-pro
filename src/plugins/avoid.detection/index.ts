import { newInjectedPage } from 'fingerprint-injector';

import { Browser, BrowserContext, Page, Plugin } from '../..';

type FingerprintGeneratorOptions = Parameters<typeof newInjectedPage>[1];

export class AvoidDetectionPlugin extends Plugin {
  fingerprintOptions?: FingerprintGeneratorOptions;

  constructor(fingerprintOptions?: FingerprintGeneratorOptions) {
    super();
    this.fingerprintOptions = fingerprintOptions;
  }

  protected async afterLaunch(browser: Browser | BrowserContext) {
    const _newPage = browser.newPage;
    browser.newPage = async (): Promise<Page> => {
      const page = await (() => {
        if (this.isStopped || !this.browser) {
          return _newPage.apply(browser);
        } else {
          return newInjectedPage({ newPage: _newPage } as Browser, this.fingerprintOptions);
        }
      })();

      return page;
    };
  }
}
