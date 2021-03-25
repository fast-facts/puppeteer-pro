// https://gist.github.com/jeroenvisser101/636030fe66ea929b63a33f5cb3a711ad

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as Puppeteer from 'puppeteer';

import { Plugin } from '../../index';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export interface ManageCookiesOption {
  saveLocation: string;
  mode: 'manual' | 'monitor';
  stringify?: (cookies: { [profile: string]: Puppeteer.Protocol.Network.Cookie[] }) => string;
  parse?: (cookies: string) => { [profile: string]: Puppeteer.Protocol.Network.Cookie[] };
  disableWarning?: boolean;
  profile?: 'string';
}

export class ManageCookiesPlugin extends Plugin {
  private saveLocation = '';
  private mode = '';
  private stringify = (cookies: { [profile: string]: Puppeteer.Protocol.Network.Cookie[] }) => JSON.stringify(cookies);
  private parse = (cookies: string) => JSON.parse(cookies);
  private disableWarning = false;
  private profile = 'default';

  private allCookies: { [profile: string]: Puppeteer.Protocol.Network.Cookie[] } = {};

  constructor(opts: ManageCookiesOption) {
    super();

    // Need to find a better typescript way of doing this
    this.saveLocation = opts.saveLocation || this.saveLocation;
    this.mode = opts.mode || this.mode;
    this.stringify = opts.stringify || this.stringify;
    this.parse = opts.parse || this.parse;
    this.disableWarning = opts.disableWarning || this.disableWarning;
    this.profile = opts.profile || this.profile;

    if (this.disableWarning !== true) {
      // tslint:disable-next-line: no-console
      console.warn('Warning: Exposing cookies in an unprotected manner can compromise your security. Add the `disableWarning` flag to remove this message.');
    }
  }

  protected async afterLaunch() {
    if (fs.existsSync(this.saveLocation)) {
      this.allCookies = this.parse(fs.readFileSync(this.saveLocation).toString() || '{}');
    }

    // tslint:disable-next-line: no-floating-promises
    this.watchCookies();
  }

  protected async afterRestart() {
    // tslint:disable-next-line: no-floating-promises
    this.watchCookies();
  }

  async switchToProfile(profile: string) {
    if (this.isStopped) return;

    this.profile = profile;

    await this.loadProfileCookies();
  }

  async save() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    await this.saveProfileCookies();
  }

  async load() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    await this.loadProfileCookies();
  }

  async clear() {
    if (this.isStopped) return;

    await this.clearProfileCookies();
  }

  private async watchCookies() {
    if (this.isStopped) return;
    if (this.mode !== 'monitor') return;

    const hash = (x: string) => crypto.createHash('md5').update(x).digest('hex');

    let oldProfile = '';
    let oldHash = '';

    while (!this.isStopped) {
      const cookies = { [this.profile]: await this.getCookies() };
      const cookiesString = this.stringify(cookies);
      const newHash = hash(cookiesString);

      if (oldProfile !== this.profile) {
        oldProfile = this.profile;
      } else if (oldHash !== newHash) {
        oldHash = newHash;
        await this.saveProfileCookies();
      } else {
        await sleep(300);
      }
    }
  }

  private async saveProfileCookies() {
    this.allCookies[this.profile] = await this.getCookies();

    const cookiesString = this.stringify(this.allCookies);
    fs.writeFileSync(this.saveLocation, cookiesString);
  }

  private async loadProfileCookies() {
    const page = await this.getFirstPage();
    if (!page) return;

    const requiresRealPage = page.url() === 'about:blank';

    if (requiresRealPage) {
      await page.goto('http://www.google.com');
    }

    await page.deleteCookie(...await this.getCookies());
    await page.setCookie(...this.allCookies[this.profile] || []);

    if (requiresRealPage) {
      await page.goBack();
    }
  }

  private async clearProfileCookies() {
    const page = await this.getFirstPage();
    if (!page) return;

    const requiresRealPage = page.url() === 'about:blank';

    if (requiresRealPage) {
      await page.goto('http://www.google.com');
    }

    await page.deleteCookie(...this.allCookies[this.profile] || []);
    delete this.allCookies[this.profile];

    const cookiesString = this.stringify(this.allCookies);
    fs.writeFileSync(this.saveLocation, cookiesString);

    if (requiresRealPage) {
      await page.goBack();
    }
  }

  private async getCookies() {
    const page = await this.getFirstPage();
    if (!page) return [];

    try {
      const client = await page.target().createCDPSession();
      const { cookies } = (await client.send('Network.getAllCookies') || {}) as { cookies: Puppeteer.Protocol.Network.Cookie[] };

      return cookies;
    }
    catch {
      return [];
    }
  }
}