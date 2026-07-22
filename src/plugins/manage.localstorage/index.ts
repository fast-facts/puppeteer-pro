// https://gist.github.com/jeroenvisser101/636030fe66ea929b63a33f5cb3a711ad

import * as crypto from 'crypto';
import * as fs from 'fs/promises';

import { Plugin } from '..';

const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

export interface ManageLocalStorageOption {
  saveLocation: string;
  mode: 'manual' | 'monitor';
  stringify?: (localStorage: Record<string, LocalStorage>) => string;
  parse?: (localStorage: string) => Record<string, LocalStorage>;
  disableWarning?: boolean;
  profile?: string;
}

export class ManageLocalStoragePlugin extends Plugin {
  private saveLocation = '';
  private mode = '';
  private stringify = (localStorage: Record<string, LocalStorage>) => JSON.stringify(localStorage);
  private parse = (localStorage: string) => JSON.parse(localStorage);
  private disableWarning = false;
  private profile = 'default';

  private allLocalStorage: Record<string, LocalStorage> = {};
  private storageEpoch = 0;

  constructor(opts: ManageLocalStorageOption) {
    super();

    // Need to find a better typescript way of doing this
    this.saveLocation = opts.saveLocation || this.saveLocation;
    this.mode = opts.mode || this.mode;
    this.stringify = opts.stringify || this.stringify;
    this.parse = opts.parse || this.parse;
    this.disableWarning = opts.disableWarning || this.disableWarning;
    this.profile = opts.profile || this.profile;

    if (this.disableWarning !== true) {
      console.warn('Warning: Exposing local storage in an unprotected manner can compromise your security. Add the `disableWarning` flag to remove this message.');
    }
  }

  protected async afterLaunch() {
    try {
      await fs.access(this.saveLocation);
      this.allLocalStorage = this.parse((await fs.readFile(this.saveLocation)).toString() || '{}');
    } catch { null; }

    void this.watchLocalStorage();
  }

  protected async afterRestart() {
    void this.watchLocalStorage();
  }

  async switchToProfile(profile: string) {
    if (this.isStopped) return;
    if (profile === this.profile) return;

    if (this.mode === 'monitor') {
      await this.saveProfileLocalStorage();
    }

    this.profile = profile;
    await this.loadProfileLocalStorage();
  }

  async save() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    await this.saveProfileLocalStorage();
  }

  async load() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    await this.loadProfileLocalStorage();
  }

  async clear() {
    if (this.isStopped) return;

    await this.clearProfileLocalStorage();
  }

  private async watchLocalStorage() {
    if (this.isStopped) return;
    if (this.mode !== 'monitor') return;

    const hash = (x: string) => crypto.createHash('md5').update(x).digest('hex');

    let oldProfile = '';
    let oldHash = '';

    while (!this.isStopped) {
      const profile = this.profile;
      const epoch = this.storageEpoch;
      const data = await this.getLocalStorage();
      if (this.isStopped || profile !== this.profile || epoch !== this.storageEpoch) continue;

      const newHash = hash(this.stringify({ [profile]: data }));

      if (oldProfile !== profile) {
        oldProfile = profile;
        oldHash = newHash;
      } else if (oldHash !== newHash) {
        oldHash = newHash;
        this.mergeProfileLocalStorage(profile, data);
        await fs.writeFile(this.saveLocation, this.stringify(this.allLocalStorage));
      } else {
        await sleep(300);
      }
    }
  }

  private mergeProfileLocalStorage(profile: string, data: LocalStorage) {
    this.allLocalStorage[profile] = {
      ...(this.allLocalStorage[profile] || {}),
      ...data,
    };
  }

  private async saveProfileLocalStorage() {
    const epoch = this.storageEpoch;
    const data = await this.getLocalStorage();
    if (epoch !== this.storageEpoch) return;
    this.mergeProfileLocalStorage(this.profile, data);

    const localStorageString = this.stringify(this.allLocalStorage);
    await fs.writeFile(this.saveLocation, localStorageString);
  }

  private async loadProfileLocalStorage() {
    this.storageEpoch++;
    await this.setLocalStorage(this.allLocalStorage[this.profile] || {});
  }

  private async clearProfileLocalStorage() {
    this.storageEpoch++;
    delete this.allLocalStorage[this.profile];
    await this.setLocalStorage({});

    const localStorageString = this.stringify(this.allLocalStorage);
    await fs.writeFile(this.saveLocation, localStorageString);
  }

  private async setLocalStorage(allLocalStorage: LocalStorage) {
    if (!this.browser) return;

    const pages = await this.browser.pages();
    const activePages = pages.filter(x => !x.isClosed() && x.url() !== 'about:blank');

    for (const page of activePages) {
      const origin = await page.evaluate(() => window.origin);

      await page.evaluate(originLocalStorage => {
        localStorage.clear();
        for (const key of Object.keys(originLocalStorage)) {
          localStorage.setItem(key, originLocalStorage[key]);
        }
      }, allLocalStorage[origin] || {});
    }
  }

  private async getLocalStorage() {
    if (!this.browser) return {};

    const allLocalStorage: LocalStorage = {};

    const pages = await this.browser.pages();
    const activePages = pages.filter(x => !x.isClosed() && x.url() !== 'about:blank');

    for (const page of activePages) {
      const originLocalStorage = await page.evaluate(() => ({ [window.origin]: { ...localStorage } })) as LocalStorage;

      Object.assign(allLocalStorage, originLocalStorage);
    }

    return allLocalStorage;
  }
}

type LocalStorage = Record<string, Record<string, string>>;
