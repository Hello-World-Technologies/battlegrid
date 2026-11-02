// Stand-in for react-native-safe-area-context: a typical Android phone (status bar on top, gesture bar below).
import React from 'react';
import { View } from 'react-native';

export const INSETS = { top: 28, bottom: 16, left: 0, right: 0 };
export const SafeAreaProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const useSafeAreaInsets = () => INSETS;
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 360, height: 780 });
export const SafeAreaView = ({ style, children, ...rest }: any) => (
  <View style={[{ paddingTop: INSETS.top, paddingBottom: INSETS.bottom }, style]} {...rest}>
    {children}
  </View>
);
export const SafeAreaInsetsContext = React.createContext(INSETS);
