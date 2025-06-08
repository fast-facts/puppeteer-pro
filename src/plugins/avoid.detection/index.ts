import { readdirSync } from 'fs';
import { resolve as resolvePath } from 'path';

import { Page, Plugin } from '../..';
import { AnonymizeUserAgentPlugin } from './../anonymize.user.agent';

const injectionsFolder = resolvePath(`${__dirname}/injections`);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const injections = readdirSync(injectionsFolder).map(fileName => require(`${injectionsFolder}/${fileName}`));

export class AvoidDetectionPlugin extends Plugin {
  dependencies = [new AnonymizeUserAgentPlugin()];

  protected async onPageCreated(page: Page) {
    for (const injection of injections) {
      if (!this.isStopped && !page.isClosed()) await page.evaluateOnNewDocument(injection);
    }
  }
}
