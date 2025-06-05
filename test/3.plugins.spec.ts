// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv-safe').config();

import * as Puppeteer from 'puppeteer';
import * as PuppeteerPro from '../src';
import { Browser, BrowserContext } from '../src';

import { anonymizeTest } from '../src/plugins/anonymize.user.agent/test.spec';
import { avoidDetectionTest } from '../src/plugins/avoid.detection/test.spec';
import { blockResourcesTest } from '../src/plugins/block.resources/test.spec';
import { disableDialogsTest } from '../src/plugins/disable.dialogs/test.spec';
import { manageCookiesTest } from '../src/plugins/manage.cookies/test.spec';
import { manageLocalStorageTest } from '../src/plugins/manage.localstorage/test.spec';
// import { solveRecaptchaTest } from '../src/plugins/solve.recaptcha/test.spec';

const pluginTests: PluginTests = {
  describe: 'PuppeteerPro\'s built-in plugins',
  tests: [{
    describe: 'can anonymize user agent',
    tests: [anonymizeTest],
  },
  {
    describe: 'can avoid detection',
    tests: [avoidDetectionTest],
  },
  {
    describe: 'can block resources',
    tests: [blockResourcesTest('document')],
  },
  {
    describe: 'can disable dialogs',
    tests: [disableDialogsTest],
  },
  {
    describe: 'can manage cookies',
    tests: [{
      describe: 'in manual mode',
      tests: [manageCookiesTest.modes('manual', { saveLocation: 'cookies.json', mode: 'manual', disableWarning: true })],
    }, {
      describe: 'in monitor mode',
      tests: [manageCookiesTest.modes('monitor', { saveLocation: 'cookies.json', mode: 'monitor', disableWarning: true })],
    }, {
      describe: 'using profiles',
      tests: [manageCookiesTest.profiles({ saveLocation: 'cookies.json', mode: 'manual', disableWarning: true })],
    }],
  },
  {
    describe: 'can manage localStorage',
    tests: [{
      describe: 'in manual mode',
      tests: [manageLocalStorageTest.modes('manual', { saveLocation: 'localStorage.json', mode: 'manual', disableWarning: true })],
    }, {
      describe: 'in monitor mode',
      tests: [manageLocalStorageTest.modes('monitor', { saveLocation: 'localStorage.json', mode: 'monitor', disableWarning: true })],
    }, {
      describe: 'using profiles',
      tests: [manageLocalStorageTest.profiles({ saveLocation: 'localStorage.json', mode: 'manual', disableWarning: true })],
    }],
    // },
    // {
    // describe: 'can solve recaptcha',
    // tests: [() => solveRecaptchaTest(PuppeteerPro.solveRecaptchas(process.env.WIT_AI_ACCESS_TOKEN))]
  }],
};

const runRecursiveTests = (x: PluginTests) => {
  if (x.describe && x.tests) {
    describe(x.describe, () => {
      for (const test of x.tests) {
        if (test instanceof Function) {
          jest.setTimeout(30 * 1000);

          let browser: Browser | undefined;

          afterEach(async () => {
            await browser?.close();
            browser = undefined;
          });

          it('on browser launch', async () => {
            await test(() => PuppeteerPro.launch({ args: ['--no-sandbox'] }));
          });

          it('on browser connect', async () => {
            const browser = await Puppeteer.launch({ args: ['--no-sandbox'] });
            const browserWSEndpoint = browser.wsEndpoint();
            await browser.disconnect();

            await test(() => PuppeteerPro.connect({ browserWSEndpoint }));
          });

          it('on browser context', async () => {
            browser = await PuppeteerPro.launch({ args: ['--no-sandbox'] });

            await test(() => browser!.createBrowserContext());
          });
        } else {
          runRecursiveTests(test);
        }
      }
    });
  }
};

runRecursiveTests(pluginTests);

interface PluginTests {
  describe: string;
  tests: PluginTests[] | ((createBrowser: () => Promise<Browser | BrowserContext>) => Promise<void>)[];
}
