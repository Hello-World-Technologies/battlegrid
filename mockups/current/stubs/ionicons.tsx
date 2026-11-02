// Stand-in for @react-native-vector-icons/ionicons: draws glyphs from the bundled Ionicons.ttf.
import React from 'react';
import { Text } from 'react-native';
import glyphs from '../../../node_modules/@react-native-vector-icons/ionicons/glyphmaps/Ionicons.json';

export default function Ionicons({ name, size = 12, color = '#000', style }: { name: string; size?: number; color?: string; style?: any }) {
  const code = (glyphs as Record<string, number>)[name];
  return (
    <Text style={[{ fontFamily: 'Ionicons', fontSize: size, color, lineHeight: size, fontWeight: 'normal' as const }, style]} selectable={false}>
      {code ? String.fromCodePoint(code) : '?'}
    </Text>
  );
}
