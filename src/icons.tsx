// src/icons.tsx
//
// Single place for every icon the shell uses. Swap the library here without
// touching screens.

import Ionicons from '@react-native-vector-icons/ionicons';

export { Ionicons };

type IconProps = { size?: number; color?: string };

export const ICONS = {
  play: (props: IconProps) => <Ionicons name="play" {...props} />,
  pause: (props: IconProps) => <Ionicons name="pause" {...props} />,
  home: (props: IconProps) => <Ionicons name="home" {...props} />,
  restart: (props: IconProps) => <Ionicons name="refresh" {...props} />,
  back: (props: IconProps) => <Ionicons name="arrow-back" {...props} />,
  next: (props: IconProps) => <Ionicons name="play-forward" {...props} />,

  settings: (props: IconProps) => <Ionicons name="settings-sharp" {...props} />,
  levels: (props: IconProps) => <Ionicons name="grid" {...props} />,
  gift: (props: IconProps) => <Ionicons name="gift" {...props} />,
  flame: (props: IconProps) => <Ionicons name="flame" {...props} />,
  person: (props: IconProps) => <Ionicons name="person" {...props} />,
  playGames: (props: IconProps) => <Ionicons name="game-controller" {...props} />,

  checkmark: (props: IconProps) => <Ionicons name="checkmark-circle" {...props} />,
  lock: (props: IconProps) => <Ionicons name="lock-closed" {...props} />,
  star: (props: IconProps) => <Ionicons name="star" {...props} />,
  trophy: (props: IconProps) => <Ionicons name="trophy" {...props} />,

  close: (props: IconProps) => <Ionicons name="close" {...props} />,
  chevron: (props: IconProps) => <Ionicons name="chevron-forward" {...props} />,
  volume: (props: IconProps) => <Ionicons name="volume-high" {...props} />,
  music: (props: IconProps) => <Ionicons name="musical-notes" {...props} />,
  vibrate: (props: IconProps) => <Ionicons name="phone-portrait" {...props} />,
  video: (props: IconProps) => <Ionicons name="play-circle" {...props} />,
  logout: (props: IconProps) => <Ionicons name="log-out" {...props} />,
  share: (props: IconProps) => <Ionicons name="share-social" {...props} />,
  edit: (props: IconProps) => <Ionicons name="pencil" {...props} />,
};
