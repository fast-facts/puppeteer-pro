// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv-safe').config();

import * as Puppeteer from 'puppeteer';
import * as PuppeteerPro from '../src/index';

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
    tests: [() => anonymizeTest(PuppeteerPro.anonymizeUserAgent())]
  },
  {
    describe: 'can avoid detection',
    tests: [() => avoidDetectionTest(PuppeteerPro.avoidDetection())]
  },
  {
    describe: 'can block resources',
    tests: [() => blockResourcesTest(PuppeteerPro.blockResources('document'))]
  },
  {
    describe: 'can disable dialogs',
    tests: [() => disableDialogsTest(PuppeteerPro.disableDialogs())]
  },
  {
    describe: 'can manage cookies',
    tests: [{
      describe: 'in manual mode',
      tests: [() => manageCookiesTest.modes('manual')(PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'manual', disableWarning: true }))]
    }, {
      describe: 'in monitor mode',
      tests: [() => manageCookiesTest.modes('monitor')(PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'monitor', disableWarning: true }))]
    }, {
      describe: 'using profiles',
      tests: [() => manageCookiesTest.profiles(PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'manual', disableWarning: true }))]
    }]
    // },
    // {
    // describe: 'can solve recaptcha',
    // tests: [() => solveRecaptchaTest(PuppeteerPro.solveRecaptchas(process.env.WIT_AI_ACCESS_TOKEN))]
  },
  {
    describe: 'can manage localStorage',
    tests: [{
      describe: 'in manual mode',
      tests: [() => manageLocalStorageTest.modes('manual')(PuppeteerPro.manageLocalStorage({ saveLocation: 'localStorage.json', mode: 'manual', disableWarning: true }))]
    }, {
      describe: 'in monitor mode',
      tests: [() => manageLocalStorageTest.modes('monitor')(PuppeteerPro.manageLocalStorage({ saveLocation: 'localStorage.json', mode: 'monitor', disableWarning: true }))]
    }, {
      describe: 'using profiles',
      tests: [() => manageLocalStorageTest.profiles(PuppeteerPro.manageLocalStorage({ saveLocation: 'localStorage.json', mode: 'manual', disableWarning: true }))]
    }]
    // },
    // {
    // describe: 'can solve recaptcha',
    // tests: [() => solveRecaptchaTest(PuppeteerPro.solveRecaptchas(process.env.WIT_AI_ACCESS_TOKEN))]
  }]
};

const runRecursiveTests = (x: PluginTests) => {
  if (x.describe && x.tests) {
    let performTest: (browserWSEndpoint?: string) => Promise<void>;

    describe(x.describe, () => {

      for (const test of x.tests) {
        if (test instanceof Function) {
          jest.setTimeout(30 * 1000);

          beforeEach(async () => {
            await PuppeteerPro.clearPlugins();
            performTest = test();
          });

          it('on browser launch', async () => {
            await performTest();
          });

          it('on browser connect', async () => {
            const browser = await Puppeteer.launch();
            const browserWSEndpoint = browser.wsEndpoint();
            browser.disconnect();

            await performTest(browserWSEndpoint);
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
  tests: PluginTests[] | (() => (browserWSEndpoint?: string) => Promise<void>)[]
}