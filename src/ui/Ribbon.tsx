// src/ui/Ribbon.tsx
//
// The big title on a result screen or dialog. The png4 design dropped the folded ribbon for plain display type
// ("Victory!"), so this is now a centred heading; `tone` tints it for win / lose moments, otherwise it is ink.

import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { FONT_DISPLAY } from './fonts';

export type RibbonTone = 'green' | 'blue' | 'red' | 'purple' | 'orange';

type Props = {
  title: string;
  tone?: RibbonTone;
  width: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Ribbon({ title, tone, width, height = 66, style }: Props) {
  const { theme } = useTheme();
  const color = tone === 'red' ? theme.redDeep : theme.ink;
  return (
    <View style={[{ width, alignItems: 'center', justifyContent: 'center', minHeight: height }, style]} accessibilityRole="header" accessibilityLabel={title}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(height * 0.5), color, textAlign: 'center' }}>
        {title}
      </Text>
    </View>
  );
}
