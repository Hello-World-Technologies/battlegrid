/* eslint-env jest */
// Native-module mocks so components can render under Jest. Firebase is mocked
// wholesale: getApps() -> [] keeps src/firebase/config.ts's isFirebaseConfigured
// false, so the app renders in its offline, guest-only path.

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// Skia needs the native module; the drawing code is exercised on a device.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children }) => React.createElement(View, null, children);
  return {
    Canvas: passthrough,
    Group: passthrough,
    Rect: () => null,
    Circle: () => null,
    Path: () => null,
    DashPathEffect: () => null,
    Skia: { Path: { MakeFromSVGString: () => ({}) } },
    Shadow: () => null,
    LinearGradient: () => null,
    Picture: () => null,
    Text: () => null,
    useFont: () => null,
    useImage: () => null,
    vec: (x, y) => ({ x, y }),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => (k in store ? store[k] : null)),
      setItem: jest.fn(async (k, v) => {
        store[k] = String(v);
      }),
      removeItem: jest.fn(async (k) => {
        delete store[k];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

jest.mock('unity-levelplay-mediation', () => {
  const ad = class {
    setListener() {}
    async loadAd() {}
    async isAdReady() {
      return false;
    }
    async showAd() {}
  };
  return {
    LevelPlay: {
      init: jest.fn(async () => {}),
      setAdaptersDebug: jest.fn(),
      setMetaData: jest.fn(),
      validateIntegration: jest.fn(async () => {}),
    },
    LevelPlayInitRequest: { builder: () => ({ build: () => ({}) }) },
    LevelPlayInterstitialAd: ad,
    LevelPlayRewardedAd: ad,
    LevelPlayAdSize: { BANNER: { width: 320, height: 50 }, createAdaptiveAdSize: jest.fn(async () => null) },
    LevelPlayBannerAdView: () => null,
  };
});

jest.mock('react-native-sound', () => {
  class Sound {
    constructor(_filename, _basePath, onLoad) {
      const cb = typeof _basePath === 'function' ? _basePath : onLoad;
      if (cb) cb(null);
    }
    setNumberOfLoops() {}
    setVolume() {}
    play() {}
    pause() {}
    stop(cb) {
      if (cb) cb();
    }
    release() {}
    static setCategory() {}
    static MAIN_BUNDLE = '';
  }
  return { __esModule: true, default: Sound };
});

jest.mock('react-native-view-shot', () => {
  const React = require('react');
  const { View } = require('react-native');
  const ViewShot = React.forwardRef(({ children, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({ capture: async () => 'file://mock-share-card.png' }));
    return React.createElement(View, props, children);
  });
  return { __esModule: true, default: ViewShot };
});

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: (_success, error) => error?.(new Error('no location in tests')),
    setRNConfiguration: () => {},
  },
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn(async () => ({ success: true, message: '' })) },
}));

jest.mock('@react-native-vector-icons/ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props) => React.createElement(Text, null, props.name),
  };
});

jest.mock('@react-native-firebase/app', () => ({
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    cb(null);
    return () => {};
  }),
  signInAnonymously: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  reload: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(),
  logLogin: jest.fn(),
}));
