module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // tests/ holds node:test suites for the game core (run with `npm run test:core`).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/'],
  // The preset's own asset transform covers images but not fonts; GameView.tsx
  // requires a .ttf directly, so route it through the same transformer.
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf)$': require.resolve(
      '@react-native/jest-preset/jest/assetFileTransformer.js',
    ),
  },
  // These packages ship untranspiled ESM; the preset's default pattern only
  // covers react-native itself and @react-native/* scoped packages.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|@react-native-firebase|@react-native-vector-icons|react-native-sound|react-native-safe-area-context|@shopify/react-native-skia)/)',
  ],
};
