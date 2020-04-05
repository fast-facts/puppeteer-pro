import * as fs from 'fs';
import * as path from 'path';
import * as Puppeteer from 'puppeteer';

import { Plugin } from '../../index';
import { AnonymizeUserAgentPlugin } from './../anonymize.user.agent/index';

const injectionsFolder = path.resolve(`${__dirname}/injections`);
const injections = fs.readdirSync(injectionsFolder).map(fileName => require(`${injectionsFolder}/${fileName}`));

export class AvoidDetectionPlugin extends Plugin {
  dependencies = [new AnonymizeUserAgentPlugin()];

  protected async onPageCreated(page: Puppeteer.Page) {
    await page.exposeFunction('isStopped', () => this.isStopped);

    for (const injection of injections) {
      await page.evaluateOnNewDocument(injection);
    }
  }
}