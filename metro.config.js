const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // The raw world datasets (data/raw, about 70 MB) are build inputs, not app code: never crawl or bundle them.
    blockList: [/[\\/]data[\\/]raw[\\/].*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
