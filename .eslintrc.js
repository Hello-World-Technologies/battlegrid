module.exports = {
  root: true,
  extends: '@react-native',
  // Design mockups (browser harness and its bundled output) and the raw map datasets are not app code.
  ignorePatterns: ['mockups/', 'data/'],
  overrides: [
    {
      // The seeded RNG and level generator use bitwise ops on purpose.
      files: ['src/game/core/**/*.ts'],
      rules: { 'no-bitwise': 'off' },
    },
    {
      // The data build hashes and packs bits on purpose, and draws with a few bitwise flags.
      files: ['scripts/**/*.ts', 'src/ui/worldMapDraw.ts', 'src/ui/draw.ts'],
      rules: { 'no-bitwise': 'off' },
    },
  ],
};
