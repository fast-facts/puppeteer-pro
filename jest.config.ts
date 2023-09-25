import type { Config } from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testMatch: ['**/test/*.spec.ts'],
  watchPathIgnorePatterns: ['cookies.json', 'localStorage.json']
};

export default config;