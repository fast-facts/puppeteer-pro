import * as Puppeteer from 'puppeteer';

import { Plugin } from '../..';

export type Resource = 'document' | 'stylesheet' | 'image' | 'media' | 'font' | 'script' | 'texttrack' | 'xhr' | 'fetch' | 'eventsource' | 'websocket' | 'manifest' | 'other';
export class BlockResourcesPlugin extends Plugin {
  requiresInterception = true;
  blockResources: Resource[];

  constructor(resources: Resource[] = []) {
    super();

    this.blockResources = resources;
  }

  protected async processRequest(request: Puppeteer.HTTPRequest) {
    if (this.blockResources.includes(request.resourceType() as Resource)) {
      await request.abort();
    } else {
      await request.continue();
    }
  }
}
