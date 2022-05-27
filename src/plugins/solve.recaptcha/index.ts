import axios from 'axios';
import * as path from 'path';
import * as Puppeteer from 'puppeteer';
import { createCursor } from 'ghost-cursor';

import { Plugin } from '../../index';
import { AvoidDetectionPlugin } from './../avoid.detection/index';

const injection = require(path.resolve(`${__dirname}/injections`) + '/utils.js');// tslint:disable-line: no-var-requires
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min;

export class SolveRecaptchaPlugin extends Plugin {
  dependencies = [new AvoidDetectionPlugin()];
  witAiAccessToken?: string;

  constructor(witAiAccessToken: string) {
    super();
    this.witAiAccessToken = witAiAccessToken;
  }

  async hasCaptcha(page: Puppeteer.Page) {
    return page.evaluate(() => !!document.querySelector<HTMLIFrameElement>('iframe[src*="api2/anchor"]')?.contentDocument?.querySelector('#recaptcha-anchor'));
  }

  async solveRecaptcha(page: Puppeteer.Page) {
    if (this.isStopped) return;
    if (!this.witAiAccessToken) return;
    if (!(await this.hasCaptcha(page))) return;

    const cursor = createCursor(page);

    async function waitForSelector(iframeUrlIncludes: string, selector: string) {
      await page.waitForFunction((_iframeUrlIncludes: string, _selector: string) => document.querySelector<HTMLIFrameElement>(`iframe[src*="${_iframeUrlIncludes}"]`)?.contentDocument?.querySelector(_selector), {}, iframeUrlIncludes, selector);
    }

    async function findAndClick(iframeUrlIncludes: string, selector: string) {
      await waitForSelector(iframeUrlIncludes, selector);

      const element = await page.frames().find(frame => frame.url().includes(iframeUrlIncludes))?.$(selector);
      if (!element) return;

      await sleep(randomBetween(1 * 1000, 3 * 1000));
      await cursor.click(element);
    }

    let numTriesLeft = 5;
    async function isFinished() {
      if (--numTriesLeft === 0) return true;
      return page.evaluate(() => !!document.querySelector<HTMLIFrameElement>('iframe[src*="api2/anchor"]')?.contentDocument?.querySelector('.recaptcha-checkbox-checked'));
    }

    await findAndClick('api2/anchor', '#recaptcha-anchor');
    await findAndClick('api2/bframe', '.rc-button-audio');

    while (!(await isFinished())) {
      await waitForSelector('api2/bframe', '.rc-audiochallenge-tdownload-link');

      const audioUrl = await page.evaluate(async () => {
        return document.querySelector<HTMLIFrameElement>('iframe[src*="api2/bframe"]')?.contentDocument?.querySelector<HTMLLinkElement>('.rc-audiochallenge-tdownload-link')?.href;
      });

      if (!audioUrl) return;

      const audioArray = await page.evaluate(injection, audioUrl);

      if (!audioArray) return;

      const audioBuffer = Buffer.from(new Int8Array(audioArray));

      const response = await axios.post<any>('https://api.wit.ai/speech?v=20220527', audioBuffer, {
        headers: {
          'Authorization': `Bearer ${this.witAiAccessToken}`,
          'Content-Type': 'audio/wav'
        }
      });

      const data = typeof response.data === 'string' ? JSON.parse(response.data.split('\r\n').slice(-1)[0] || '{}') : response.data;

      if (data?.text) {
        const responseInput = await page.frames().find(frame => frame.url().includes('api2/bframe'))?.$('#audio-response');
        responseInput?.type(data.text);

        await findAndClick('api2/bframe', '#recaptcha-verify-button');

        await sleep(1000);
      } else {
        await findAndClick('api2/bframe', '#recaptcha-reload-button');
      }
    }
  }
}

function sleep(timeout: number) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}