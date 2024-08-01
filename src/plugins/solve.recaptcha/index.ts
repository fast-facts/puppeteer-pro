import axios from 'axios';
import * as path from 'path';
import * as Puppeteer from 'puppeteer';
import { createCursor } from 'ghost-cursor';

import { Plugin } from '../../index';
import { AvoidDetectionPlugin } from './../avoid.detection/index';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const injection = require(path.resolve(`${__dirname}/injections`) + '/utils.js');
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min;

export class SolveRecaptchaPlugin extends Plugin {
  dependencies = [new AvoidDetectionPlugin()];
  witAiAccessToken?: string;

  constructor(witAiAccessToken: string) {
    super();
    this.witAiAccessToken = witAiAccessToken;
  }

  async waitForCaptcha(page: Puppeteer.Page, timeout?: number) {
    return page.waitForFunction(() => !!document.querySelector<HTMLIFrameElement>('iframe[src*="api2/anchor"]')
      && !!document.querySelector<HTMLIFrameElement>('iframe[src*="api2/bframe"]'), { timeout });
  }

  async hasCaptcha(page: Puppeteer.Page) {
    return page.evaluate(() => !!document.querySelector<HTMLIFrameElement>('iframe[src*="api2/anchor"]')
      && !!document.querySelector<HTMLIFrameElement>('iframe[src*="api2/bframe"]'));
  }

  async solveRecaptcha(page: Puppeteer.Page) {
    if (this.isStopped) return;
    if (!this.witAiAccessToken) return;
    if (!(await this.hasCaptcha(page))) return;

    const anchorFrame = page.frames().find(x => x.url().includes('api2/anchor'));
    if (!anchorFrame) return;

    const cursor = createCursor(page);

    async function waitForSelector(iframe: Puppeteer.Frame, selector: string) {
      await iframe.waitForFunction((_selector: string) => document.querySelector(_selector), {}, selector);
    }

    async function findAndClick(iframe: Puppeteer.Frame, selector: string) {
      await waitForSelector(iframe, selector);

      const element = await iframe.$(selector);
      if (!element) return;

      await sleep(randomBetween(1 * 1000, 3 * 1000));
      await cursor.click(element);
    }

    let numTriesLeft = 5;
    async function isFinished() {
      if (--numTriesLeft === 0) return true;
      return anchorFrame?.evaluate(() => !!document.querySelector('.recaptcha-checkbox-checked'));
    }

    await findAndClick(anchorFrame, '#recaptcha-anchor');

    const bframeFrame = page.frames().find(x => x.url().includes('api2/bframe'));
    if (!bframeFrame) return;

    await findAndClick(bframeFrame, '.rc-button-audio');

    while (!(await isFinished())) {
      await waitForSelector(bframeFrame, '.rc-audiochallenge-tdownload-link');

      const audioUrl = await bframeFrame.evaluate(async () => document.querySelector<HTMLLinkElement>('.rc-audiochallenge-tdownload-link')?.href);
      if (!audioUrl) return;

      const audioArray = await bframeFrame.evaluate(injection, audioUrl);
      if (!audioArray) return;

      const audioBuffer = Buffer.from(new Int8Array(audioArray));

      const response = await axios.post<any>('https://api.wit.ai/speech?v=20220527', audioBuffer, {
        headers: {
          Authorization: `Bearer ${this.witAiAccessToken}`,
          'Content-Type': 'audio/wav'
        }
      });

      const data = typeof response.data === 'string' ? JSON.parse(response.data.split('\r\n').slice(-1)[0] || '{}') : response.data;

      if (data?.text) {
        const responseInput = await bframeFrame.$('#audio-response');
        await responseInput?.type(data.text);

        await findAndClick(bframeFrame, '#recaptcha-verify-button');

        await sleep(1000);
      } else {
        await findAndClick(bframeFrame, '#recaptcha-reload-button');
      }
    }
  }
}

function sleep(timeout: number) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}