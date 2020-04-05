const Puppeteer = require('puppeteer');
const PuppeteerPro = require('../dist/index');

const sleep = time => { return new Promise(resolve => { setTimeout(resolve, time); }); };
const waitUntil = async func => { while (!func()) await sleep(200); };

const anonymizeTest = require('../src/plugins/anonymize.user.agent/test.js');
const avoidDetectionTest = require('../src/plugins/avoid.detection/test.js');
const blockResourcesTest = require('../src/plugins/block.resources/test.js');
const disableDialogsTest = require('../src/plugins/disable.dialogs/test.js');
const manageCookiesTest = require('../src/plugins/manage.cookies/test.js');

const pluginTests = {
  describe: `PuppeteerPro's built-in plugins`,
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
      tests: [() => manageCookiesTest('manual')(PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'manual', disableWarning: true }))]
    }, {
      describe: 'in monitor mode',
      tests: [() => manageCookiesTest('monitor')(PuppeteerPro.manageCookies({ saveLocation: 'cookies.json', mode: 'monitor', disableWarning: true }))]
    }]
  }]
};

const runRecursiveTests = x => {
  if (x.describe && x.tests) {
    let performTest;
    let testsFinished = 0;

    describe(x.describe, () => {

      x.tests.forEach((test, i) => {
        if (test.describe) {
          return runRecursiveTests(test);
        } else {
          before(async () => {
            await waitUntil(() => testsFinished === i);
          });

          after(() => { testsFinished++; });

          beforeEach(() => {
            PuppeteerPro.clearPlugins();
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
        }
      });

    });
  }
};

runRecursiveTests(pluginTests);
