import * as Puppeteer from 'puppeteer';

import { Plugin } from '../../index';

export class DisableDialogsPlugin extends Plugin {
  logMessages: boolean;

  constructor(logMessages = false) {
    super();

    this.logMessages = logMessages;
  }

  protected async processDialog(dialog: Puppeteer.Dialog) {
    if (this.logMessages) {
      console.log(`Dialog message: ${dialog.message()}`);
    }

    await dialog.dismiss();
  }
}
