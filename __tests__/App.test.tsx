/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Skia needs the native module; the drawing code is exercised on a device.
jest.mock('../src/ui/GameView', () => ({ GameView: 'GameView' }));

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  // Firebase is off under Jest, so the app mints a device-local guest and
  // starts on the splash screen.
  expect(JSON.stringify(renderer?.toJSON())).toContain('Plan · Conquer · Win');
  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});
