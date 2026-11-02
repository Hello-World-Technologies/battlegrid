// Harness-only wrapper around @shopify/react-native-skia for the web build:
//  - Canvas gets a flattened style (RN style arrays are not valid DOM styles),
//  - matchFont / useFont load the app's bundled TTFs directly (the web build has no system font manager).
// Everything else is Skia unchanged.
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import * as Real from '../../../node_modules/@shopify/react-native-skia/lib/module/index.js';

export * from '../../../node_modules/@shopify/react-native-skia/lib/module/index.js';

const { Skia } = Real as any;

// Offscreen surfaces snapshot to a blank image on the web build; the app falls back to drawing the land directly when this is null.
try {
  Skia.Surface.MakeOffscreen = () => null;
} catch {
  /* read-only: keep the default */
}

const typefaces = new Map<string, any>();
async function typefaceFor(url: string) {
  if (!typefaces.has(url)) {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    typefaces.set(url, Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes)));
  }
  return typefaces.get(url);
}

const BODY = '/assets/fonts/Poppins-Bold.ttf';
const DISPLAY = '/assets/fonts/LilitaOne-Regular.ttf';

/** Load the fonts that the app asks for by name before any screen draws. */
export async function preloadFonts() {
  await Promise.all([typefaceFor(BODY), typefaceFor(DISPLAY)]);
}

export const matchFont = (style?: { fontSize?: number }) => Skia.Font(typefaces.get(BODY), style?.fontSize ?? 14);

export function useFont(source: unknown, size?: number) {
  const [font, setFont] = useState<any>(null);
  useEffect(() => {
    let live = true;
    const url = typeof source === 'string' ? source : DISPLAY;
    typefaceFor(url.includes('Lilita') || url === DISPLAY ? DISPLAY : url).then((tf) => {
      if (!live) return;
      const f = Skia.Font(tf, size ?? 14);
      // On web, Font.getTypeface() returns a raw pointer that cannot be passed back into Skia.Font(); hand back the owned one.
      f.getTypeface = () => tf;
      setFont(f);
    });
    return () => {
      live = false;
    };
  }, [source, size]);
  return font;
}

export const Canvas = ({ style, ...rest }: any) => <Real.Canvas style={StyleSheet.flatten(style)} {...rest} />;
