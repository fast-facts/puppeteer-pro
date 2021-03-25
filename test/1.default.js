/* eslint-disable semi */
const PuppeteerPro = require('../dist/index');
const chai = require('chai');

const expect = chai.expect;

describe('Original methods', () => {
  ['connect', 'launch'].map(x => {
    it(`should have ${x}`, () => {
      expect(PuppeteerPro[x]).to.be.not.undefined;
    });
  });
});

