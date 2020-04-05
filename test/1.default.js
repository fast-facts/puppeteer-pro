/* eslint-disable semi */
const PuppeteerPro = require('../dist/index');
const chai = require('chai');

const expect = chai.expect;

describe('Original methods', () => {
  ['connect', 'defaultArgs', 'executablePath', 'launch', 'createBrowserFetcher'].map(x => {
    it(`should have ${x}`, () => {
      expect(PuppeteerPro[x]).to.be.not.undefined;
    });
  });
});

