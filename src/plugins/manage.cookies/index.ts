// https://gist.github.com/jeroenvisser101/636030fe66ea929b63a33f5cb3a711ad

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import type { Cookie } from 'puppeteer';

import { Plugin } from '..';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export interface ManageCookiesOption {
  saveLocation: string;
  mode: 'manual' | 'monitor';
  stringify?: (cookies: Record<string, Cookie[]>) => string;
  parse?: (cookies: string) => Record<string, Cookie[]>;
  disableWarning?: boolean;
  profile?: string;
}

export class ManageCookiesPlugin extends Plugin {
  private saveLocation = '';
  private mode = '';
  private stringify = (cookies: Record<string, Cookie[]>) => JSON.stringify(cookies);
  private parse = (cookies: string) => JSON.parse(cookies);
  private disableWarning = false;
  private profile = 'default';

  private allCookies: Record<string, Cookie[]> = {};
  private cookiesEpoch = 0;

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
      console.warn('Warning: Exposing cookies in an unprotected manner can compromise your security. Add the `disableWarning` flag to remove this message.');
    }
  }

  protected async afterLaunch() {
    try {
      await fs.access(this.saveLocation);
      this.allCookies = this.parse((await fs.readFile(this.saveLocation)).toString() || '{}');
    } catch { null; }

    void this.watchCookies();
  }

  protected async afterRestart() {
    void this.watchCookies();
  }

  async switchToProfile(profile: string) {
    if (this.isStopped) return;
    if (profile === this.profile) return;

    if (this.mode === 'monitor') {
      await this.saveProfileCookies();
    }

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
      const profile = this.profile;
      const epoch = this.cookiesEpoch;
      const data = await this.getCookies();
      if (this.isStopped || profile !== this.profile || epoch !== this.cookiesEpoch) continue;

      const newHash = hash(this.stringify({ [profile]: data }));

      if (oldProfile !== profile) {
        oldProfile = profile;
        oldHash = newHash;
      } else if (oldHash !== newHash) {
        oldHash = newHash;
        this.allCookies[profile] = data;
        await fs.writeFile(this.saveLocation, this.stringify(this.allCookies));
      } else {
        await sleep(300);
      }
    }
  }

  private async saveProfileCookies() {
    const epoch = this.cookiesEpoch;
    const data = await this.getCookies();
    if (epoch !== this.cookiesEpoch) return;
    this.allCookies[this.profile] = data;

    const cookiesString = this.stringify(this.allCookies);
    await fs.writeFile(this.saveLocation, cookiesString);
  }

  private async loadProfileCookies() {
    if (!this.browser) return;
    this.cookiesEpoch++;
    await this.browser.deleteCookie(...await this.getCookies());
    await this.browser.setCookie(...this.allCookies[this.profile] || []);
  }

  private async clearProfileCookies() {
    this.cookiesEpoch++;
    await this.browser?.deleteCookie(...await this.getCookies());
    delete this.allCookies[this.profile];

    const cookiesString = this.stringify(this.allCookies);
    await fs.writeFile(this.saveLocation, cookiesString);
  }

  private async getCookies() {
    try {
      return await this.browser?.cookies() || [];
    } catch {
      return [];
    }
  }
}
