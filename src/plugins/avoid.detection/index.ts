import { readdirSync } from 'fs';
import { resolve as resolvePath } from 'path';
import * as Puppeteer from 'puppeteer';

import { Plugin } from '../../index';
import { AnonymizeUserAgentPlugin } from './../anonymize.user.agent/index';

const injectionsFolder = resolvePath(`${__dirname}/injections`);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const injections = readdirSync(injectionsFolder).map(fileName => require(`${injectionsFolder}/${fileName}`));

export class AvoidDetectionPlugin extends Plugin {
  dependencies = [new AnonymizeUserAgentPlugin()];

  protected async onPageCreated(page: Puppeteer.Page) {
    for (const injection of injections) {
      if (!this.isStopped && !page.isClosed()) await page.evaluateOnNewDocument(injection);
    }
  }
}