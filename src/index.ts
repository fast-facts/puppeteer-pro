import * as events from 'events';

// Puppeteer Defaults
import * as Puppeteer from 'puppeteer';

import type { Plugin } from './plugins';
import { newPage } from './plugins/shared';

export async function connect(options?: Puppeteer.ConnectOptions): Promise<Browser> {
  const browser = await Puppeteer.connect(options || {});

  return createBrowser(browser);
}

export async function launch(options?: Puppeteer.LaunchOptions & Puppeteer.ConnectOptions): Promise<Browser> {
  if (!options) options = {};

  process.env.PUPPETEER_DISABLE_HEADLESS_WARNING = 'true';
  const browser = await Puppeteer.launch({ defaultViewport: undefined, ...options });

  return createBrowser(browser);
}

async function createBrowser(puppeteerBrowser: Puppeteer.Browser): Promise<Browser> {
  const browser = puppeteerBrowser as Browser;

  const _close = browser.close;
  browser.close = async () => {
    await _close.apply(browser);
    browser.browserEvents.emit('close');
  };

  const _createBrowserContext = browser.createBrowserContext;
  browser.createBrowserContext = async (options?: Puppeteer.BrowserContextOptions) => {
    const context: Puppeteer.BrowserContext = await _createBrowserContext.apply(browser, options);

    return createBrowserContext(context);
  };

  const _newPage = browser.newPage;
  browser.newPage = async () => {
    const page: Puppeteer.Page = await _newPage.apply(browser);

    return newPage(page);
  };

  addPluginSupport(browser);

  return browser;
}

async function createBrowserContext(puppeteerBrowserContext: Puppeteer.BrowserContext): Promise<BrowserContext> {
  const browser = puppeteerBrowserContext as BrowserContext;

  const _close = browser.close;
  browser.close = async () => {
    await _close.apply(browser);
    browser.browserEvents.emit('close');
  };

  const _newPage = browser.newPage;
  browser.newPage = async () => {
    const page: Puppeteer.Page = await _newPage.apply(browser);

    return newPage(page);
  };

  addPluginSupport(browser);

  return browser;
}

function addPluginSupport(browser: Browser | BrowserContext) {
  browser.plugins = [];
  browser.browserEvents = new events.EventEmitter();
  browser.interceptions = 0;

  browser.addPlugin = async (plugin: Plugin) => {
    if (browser.plugins.includes(plugin)) return;
    browser.plugins.push(plugin);
    await plugin.init(browser);
  };

  browser.clearPlugins = async () => {
    await Promise.all(browser.plugins.map(p => p.stop()));
    browser.plugins = [];
  };

  browser.anonymizeUserAgent = async (): Promise<AnonymizeUserAgentPlugin> => {
    const plugin = new AnonymizeUserAgentPlugin();
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.avoidDetection = async (options?: FingerprintGeneratorOptions): Promise<AvoidDetectionPlugin> => {
    const plugin = new AvoidDetectionPlugin(options);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.blockResources = async (...resources: Resource[]): Promise<BlockResourcesPlugin> => {
    const plugin = new BlockResourcesPlugin(resources);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.disableDialogs = async (logMessages = false): Promise<DisableDialogsPlugin> => {
    const plugin = new DisableDialogsPlugin(logMessages);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.manageCookies = async (opts: ManageCookiesOption): Promise<ManageCookiesPlugin> => {
    const plugin = new ManageCookiesPlugin(opts);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.manageLocalStorage = async (opts: ManageLocalStorageOption): Promise<ManageLocalStoragePlugin> => {
    const plugin = new ManageLocalStoragePlugin(opts);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.solveRecaptchas = async (accessToken: string): Promise<SolveRecaptchasPlugin> => {
    const plugin = new SolveRecaptchasPlugin(accessToken);
    await browser.addPlugin(plugin);
    return plugin;
  };
}

// PuppeteerPro
export interface Browser extends Puppeteer.Browser, Pluginable {
  createBrowserContext(options?: Puppeteer.BrowserContextOptions): Promise<BrowserContext>;
  newPage(): Promise<Page>;
}

export interface BrowserContext extends Puppeteer.BrowserContext, Pluginable {
  newPage(): Promise<Page>;
}

export interface Page extends Puppeteer.Page {
  waitAndClick(selector: string, waitOptions?: Puppeteer.WaitForSelectorOptions, clickOptions?: Readonly<Puppeteer.ClickOptions>): Promise<void>;
  waitAndType(selector: string, text: string, waitOptions?: Puppeteer.WaitForSelectorOptions, typeOptions?: Readonly<Puppeteer.KeyboardTypeOptions>): Promise<void>;
  withLoader<T>(fn: () => Promise<T>, loadingSelector: string, visibleWaitOptions?: Puppeteer.WaitForSelectorOptions, hiddenWaitOptions?: Puppeteer.WaitForSelectorOptions): Promise<T>;
}
interface Pluginable {
  plugins: Plugin[];
  browserEvents: events.EventEmitter;
  interceptions: number;

  addPlugin: (plugin: Plugin) => Promise<void>;
  clearPlugins: () => Promise<void>;
  anonymizeUserAgent: () => Promise<AnonymizeUserAgentPlugin>;
  avoidDetection: (options?: FingerprintGeneratorOptions) => Promise<AvoidDetectionPlugin>;
  blockResources: (...resources: Resource[]) => Promise<BlockResourcesPlugin>;
  disableDialogs: (logMessages?: boolean) => Promise<DisableDialogsPlugin>;
  manageCookies: (opts: ManageCookiesOption) => Promise<ManageCookiesPlugin>;
  manageLocalStorage: (opts: ManageLocalStorageOption) => Promise<ManageLocalStoragePlugin>;
  solveRecaptchas: (accessToken: string) => Promise<SolveRecaptchasPlugin>;
}

import { AnonymizeUserAgentPlugin } from './plugins/anonymize.user.agent';
import { AvoidDetectionPlugin } from './plugins/avoid.detection';
import { BlockResourcesPlugin, Resource } from './plugins/block.resources';
import { DisableDialogsPlugin } from './plugins/disable.dialogs';
import { ManageCookiesOption, ManageCookiesPlugin } from './plugins/manage.cookies';
import { ManageLocalStorageOption, ManageLocalStoragePlugin } from './plugins/manage.localstorage';
import { SolveRecaptchasPlugin } from './plugins/solve.recaptchas';

import type { newInjectedPage } from 'fingerprint-injector';
type FingerprintGeneratorOptions = Parameters<typeof newInjectedPage>[1];
