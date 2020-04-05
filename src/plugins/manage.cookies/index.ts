// https://gist.github.com/jeroenvisser101/636030fe66ea929b63a33f5cb3a711ad

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as Puppeteer from 'puppeteer';

import { Plugin } from '../../index';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export interface ManageCookiesOption {
  saveLocation: string;
  mode: 'manual' | 'monitor';
  stringify?: (cookies: Puppeteer.Cookie[]) => string;
  parse?: (cookies: string) => Puppeteer.Cookie[];
  disableWarning?: boolean;
}

export class ManageCookiesPlugin extends Plugin {
  private saveLocation = '';
  private mode = '';
  private stringify = (cookies: Puppeteer.Cookie[]) => JSON.stringify(cookies);
  private parse = (cookies: string) => JSON.parse(cookies);
  private disableWarning = false;

  constructor(opts: ManageCookiesOption) {
    super();

    // Need to find a better typescript way of doing this
    this.saveLocation = opts.saveLocation || this.saveLocation;
    this.mode = opts.mode || this.mode;
    this.stringify = opts.stringify || this.stringify;
    this.parse = opts.parse || this.parse;
    this.disableWarning = opts.disableWarning || this.disableWarning;

    if (this.disableWarning !== true) {
      // tslint:disable-next-line: no-console
      console.warn('Warning: Exposing cookies in an unprotected manner can compromise your security. Add the `disableWarning` flag to remove this message.');
    }
  }

  protected async afterLaunch() {
    this.watchCookies();
  }

  protected async afterRestart() {
    this.watchCookies();
  }

  async save() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    const page = await this.getFirstPage();
    if (!page) return;

    const cookiesString = this.stringify(await this.getCookies());
    fs.writeFileSync(this.saveLocation, cookiesString);
  }

  async load() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    const page = await this.getFirstPage();
    if (!page) return;

    const requiresRealPage = page.url() === 'about:blank';

    if (fs.existsSync(this.saveLocation)) {
      if (requiresRealPage) {
        await page.goto('http://www.google.com');
      }

      const cookies = this.parse(fs.readFileSync(this.saveLocation).toString() || '[]');
      await page.setCookie(...cookies);

      if (requiresRealPage) {
        await page.goBack();
      }
    }
  }

  async clear() {
    if (this.isStopped) return;

    const page = await this.getFirstPage();
    if (!page) return;

    await page.deleteCookie(...await this.getCookies());

    if (fs.existsSync(this.saveLocation)) {
      fs.unlinkSync(this.saveLocation);
    }
  }

  private async watchCookies() {
    if (this.isStopped) return;
    if (this.mode !== 'monitor') return;

    const page = await this.getFirstPage();
    if (!page) return;

    const hash = (x: string) => crypto.createHash('md5').update(x).digest('hex');

    let oldHash = '';
    while (!this.isStopped) {
      const cookiesString = this.stringify(await this.getCookies());
      const newHash = hash(cookiesString);

      if (oldHash !== newHash) {
        fs.writeFileSync(this.saveLocation, cookiesString);
        oldHash = newHash;
      }

      await sleep(300);
    }
  }

  private async getCookies() {
    const page = await this.getFirstPage();
    if (!page) return [];

    const client = await page.target().createCDPSession();
    const { cookies } = await client.send("Network.getAllCookies", {}) as { cookies: Puppeteer.Cookie[] };

    return cookies;
  }
}