// Stand-in for react-native-view-shot: renders its children in a plain View (the mockups never actually
// trigger a capture), so ShareCard still mounts for screenshots without pulling in the native module.
import React, { forwardRef } from 'react';
import { View } from 'react-native';

const ViewShot = forwardRef(({ children, ...rest }: any, ref: any) => (
  <View ref={ref} {...rest}>
    {children}
  </View>
));

export default ViewShot;
