import { Canvas, Picture, type SkPicture } from '@shopify/react-native-skia';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { GameSession } from '../game/session';
import { ITEM_TARGET, type ItemId } from '../game/core';
import { COL, TEXT } from '../game/theme';
import { ITEM_SHOP } from '../shop';
import { Hand } from './Decor';
import { recordFrame } from './draw';
import { FONT_DISPLAY } from './fonts';

/** The layout is designed on a 720-wide reference screen; every HUD size scales from it. */
const REF_W = 720;

interface Props {
  session: GameSession;
  /** False on menus, pause and result screens: the world is frozen but still drawn. */
  running: boolean;
  onPause: () => void;
  onEnd: (status: 'won' | 'lost') => void;
}

/** A number that eases to its new value, so the status bar grows and shrinks smoothly. */
function useTween(target: number, duration = 320) {
  const v = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [target, duration, v]);
  return v;
}

export function GameView({ session, running, onPause, onEnd }: Props) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  // Re-renders the HUD (territory shares, teaching hand, the item row) a few times a second.
  const [, setTick] = useState(0);
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  // Level 1 teaches the move with a pointing hand until the first squad is sent.
  const [teach, setTeach] = useState(session.level === 1);
  const handAnim = useRef(new Animated.Value(0)).current;
  const mapAnim = useRef(new Animated.Value(0)).current;

  const runningRef = useRef(running);
  const onEndRef = useRef(onEnd);
  const size = useRef({ w: 0, h: 0 });
  runningRef.current = running;
  onEndRef.current = onEnd;

  // A new level: reset the hand, and bring the new map in.
  useEffect(() => {
    setTeach(session.level === 1);
    mapAnim.setValue(0);
    Animated.timing(mapAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [session, mapAnim]);

  // Game loop: step the world, then record and show one frame.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let hudIn = 0;
    let ended = false;
    const loop = (now: number) => {
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
      last = now;
      session.w = size.current.w;
      session.h = size.current.h;
      if (session.w > 1) {
        const run = runningRef.current && !ended;
        session.update(dt, run);
        if (run && session.world.status !== 'play') {
          ended = true;
          onEndRef.current(session.world.status);
        }
        if (session.world.dots.length > 0) setTeach(false);
        hudIn -= dt;
        if (hudIn <= 0) {
          hudIn = 0.1;
          setTick((n) => n + 1);
        }
        setPicture(recordFrame(session, runningRef.current));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session]);

  // The hand: press your own territory, then press the one to take. One subtle loop.
  useEffect(() => {
    if (!teach) return;
    handAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(handAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [teach, handAnim]);

  // Territories held out of all territories; grey is still unclaimed.
  const T = session.world.territories;
  const held = (o: number) => T.filter((t) => t.owner === o).length;
  const share = { you: held(1), red: held(2), green: held(3), purple: held(4), rest: held(0) };
  const you = useTween(share.you);
  const red = useTween(share.red);
  const green = useTween(share.green);
  const purple = useTween(share.purple);
  const rest = useTween(share.rest);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.current = { w: width, h: height };
    setLayout({ w: width, h: height });
  };

  const u = layout.w / REF_W;
  const slide = mapAnim.interpolate({ inputRange: [0, 1], outputRange: [layout.w * 0.1, 0] });
  const fade = mapAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const sep = Math.max(1.5, 3 * u);
  const heldItems = ITEM_SHOP.filter((i) => session.heldOf(i.id) > 0);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, transform: [{ translateX: slide }] }]}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {picture && <Picture picture={picture} />}
        </Canvas>
      </Animated.View>

      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => runningRef.current}
        onMoveShouldSetResponder={() => runningRef.current}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => session.pointerDown(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderMove={(e) => session.pointerMove(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderRelease={(e) => session.pointerUp(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderTerminate={() => session.pointerCancel()}
      />

      {/* Fixed HUD: it never moves with the map. */}
      {u > 0 ? (
        <>
          <Pressable
            onPress={onPause}
            accessibilityRole="button"
            accessibilityLabel="Pause"
            hitSlop={12 * u}
            style={{ position: 'absolute', left: 72 * u - 34 * u, top: 76 * u - 34 * u, width: 68 * u, height: 68 * u, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: 30 * u,
                height: 30 * u,
                borderLeftWidth: 9 * u,
                borderBottomWidth: 9 * u,
                borderColor: '#141414',
                borderRadius: 3 * u,
                transform: [{ rotate: '45deg' }],
                marginLeft: 10 * u,
              }}
            />
          </Pressable>

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 85 * u - 15 * u,
              left: (layout.w - 376 * u) / 2,
              width: 376 * u,
              height: 30 * u,
              borderRadius: 15 * u,
              borderWidth: 4 * u,
              borderColor: '#ffffff',
              backgroundColor: '#5c5c5c',
              flexDirection: 'row',
              overflow: 'hidden',
            }}
          >
            {[
              { n: share.you, flex: you, color: COL[1] },
              { n: share.red, flex: red, color: '#e01010' },
              { n: share.green, flex: green, color: '#1fa01f' },
              { n: share.purple, flex: purple, color: '#8a3fd0' },
              { n: share.rest, flex: rest, color: '#5c5c5c' },
            ].map((seg, i, all) => (
              <Fragment key={i}>
                {seg.n > 0 && all.slice(0, i).some((p) => p.n > 0) ? <View style={{ width: sep, backgroundColor: '#ffffff' }} /> : null}
                <Animated.View style={{ flex: seg.flex, backgroundColor: seg.color }} />
              </Fragment>
            ))}
          </View>
        </>
      ) : null}

      {/* Items: pick one from the row at the bottom, then (for most) tap a tower. */}
      {u > 0 ? (
        <>
          {session.armed ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 128 * u,
                alignSelf: 'center',
                paddingHorizontal: 20 * u,
                height: 40 * u,
                borderRadius: 20 * u,
                backgroundColor: '#ff8a1c',
                borderWidth: 3 * u,
                borderColor: '#ffffff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: FONT_DISPLAY, fontSize: 19 * u, color: '#ffffff' }}>{ARM_PROMPT[ITEM_TARGET[session.armed]]}</Text>
            </View>
          ) : null}

          {/* Items running right now: Surge and Rally count down. */}
          {session.world.buffs && (session.world.buffs.surge > 0 || session.world.buffs.rally > 0) ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 176 * u, alignSelf: 'center', flexDirection: 'row', gap: 8 * u }}>
              {session.world.buffs.surge > 0 ? <BuffChip u={u} label={`⚡ SURGE ${Math.ceil(session.world.buffs.surge)}s`} color="#ffb400" /> : null}
              {session.world.buffs.rally > 0 ? <BuffChip u={u} label={`🏃 RALLY ${Math.ceil(session.world.buffs.rally)}s`} color="#9a5bd8" /> : null}
            </View>
          ) : null}

          {/* The item row: one square tile for each item you hold, like the icon row on a game's home screen. Tap one to
              pick it; it lifts and glows until you tap a tower (or tap it again to put it away). The count on each tile
              is how many you have left to use. */}
          {heldItems.length > 0 ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 20 * u, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 22 * u, rowGap: 30 * u, paddingHorizontal: 24 * u }}>
                {heldItems.map((i) => {
                  const ok = session.canUse(i.id);
                  const armed = session.armed === i.id;
                  return (
                    <ItemTile
                      key={i.id}
                      u={u}
                      color={TILE_COLOR[i.id]}
                      emoji={i.emoji}
                      count={session.heldOf(i.id)}
                      armed={armed}
                      dim={!ok || (!!session.armed && !armed)}
                      disabled={!running || !ok}
                      label={`${i.name}, ${session.heldOf(i.id)} held`}
                      onPress={() => {
                        session.pickItem(i.id);
                        setTick((n) => n + 1);
                      }}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {teach && running && u > 0 ? <TeachHand session={session} anim={handAnim} handSize={64 * u} /> : null}
    </View>
  );
}

/** What the prompt says while an item is armed, by what it needs you to tap. */
const ARM_PROMPT = { foe: 'TAP A TOWER TO HIT IT', enemy: 'TAP AN ENEMY TOWER', mine: 'TAP ONE OF YOUR TOWERS', none: '' } as const;

/** The colour of each item's tile in the bottom row. */
const TILE_COLOR: Readonly<Record<ItemId, string>> = {
  bomb: '#4a5d82',
  megabomb: '#a6382a',
  freeze: '#3f9d8f',
  airdrop: '#a6642a',
  shield: '#9ab53e',
  surge: '#e2a321',
  rally: '#8a5fc8',
  provoke: '#d4572a',
  flak: '#5d7290',
  recall: '#2a8f80',
};

/** One square item tile: a flat colour, a chunky dark edge, the item's picture and how many you hold. */
function ItemTile({
  u,
  color,
  emoji,
  count,
  armed,
  dim,
  disabled,
  label,
  onPress,
}: {
  u: number;
  color: string;
  emoji: string;
  count: number;
  armed: boolean;
  dim: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const size = 100 * u;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: armed, disabled }}
      hitSlop={6 * u}
      style={{ width: size, height: size, opacity: dim ? 0.45 : 1, transform: [{ translateY: armed ? -18 * u : 0 }] }}
    >
      {armed ? <View style={{ position: 'absolute', left: -10 * u, right: -10 * u, top: -10 * u, bottom: -2 * u, borderRadius: 34 * u, backgroundColor: 'rgba(255,138,28,0.6)' }} /> : null}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 9 * u, height: size, borderRadius: 26 * u, backgroundColor: TEXT }} />
      <View
        style={{
          flex: 1,
          borderRadius: 26 * u,
          borderWidth: 5 * u,
          borderColor: armed ? '#ffffff' : TEXT,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ position: 'absolute', top: 5 * u, left: 10 * u, right: 10 * u, height: 9 * u, borderRadius: 5 * u, backgroundColor: 'rgba(255,255,255,0.38)' }} />
        <Text style={{ fontSize: 46 * u, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 * u }, textShadowRadius: 2 }}>{emoji}</Text>
      </View>
      <View
        style={{ position: 'absolute', top: -12 * u, right: -12 * u, minWidth: 38 * u, height: 38 * u, borderRadius: 19 * u, paddingHorizontal: 7 * u, backgroundColor: '#d41f1f', borderWidth: 3.5 * u, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: FONT_DISPLAY, fontSize: 20 * u, color: '#ffffff' }}>{count}</Text>
      </View>
    </Pressable>
  );
}

/** A small pill saying an item is running and for how long. */
function BuffChip({ u, label, color }: { u: number; label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 14 * u, height: 34 * u, borderRadius: 17 * u, backgroundColor: color, borderWidth: 3 * u, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONT_DISPLAY, fontSize: 16 * u, color: '#ffffff' }}>{label}</Text>
    </View>
  );
}

/**
 * A pointing hand that shows the move: it comes down onto your territory (a press), lifts,
 * travels to the nearest territory you do not own and comes down again. It is placed from the
 * territories' own screen positions, so it lands correctly on any screen size.
 */
function TeachHand({ session, anim, handSize }: { session: GameSession; anim: Animated.Value; handSize: number }) {
  const T = session.world.territories;
  const mine = T.find((t) => t.owner === 1);
  if (!mine) return null;
  let target = T[0];
  let best = Infinity;
  for (const t of T) {
    if (t.owner === 1) continue;
    const d = Math.hypot(t.x - mine.x, t.y - mine.y);
    if (d < best) {
      best = d;
      target = t;
    }
  }
  // The fingertip is near the top-left of the hand image.
  const ox = -handSize * 0.28;
  const oy = -handSize * 0.08;
  const lift = handSize * 0.55;
  const x0 = session.px(mine) + ox;
  const y0 = session.py(mine) + oy;
  const x1 = session.px(target) + ox;
  const y1 = session.py(target) + oy;
  const stops = [0, 0.1, 0.22, 0.3, 0.52, 0.66, 0.76, 0.92, 1];
  const tx = anim.interpolate({ inputRange: stops, outputRange: [x0, x0, x0, x0, x1, x1, x1, x1, x1] });
  const ty = anim.interpolate({ inputRange: stops, outputRange: [y0 - lift, y0 - lift, y0, y0 - lift * 0.5, y1 - lift, y1, y1 - lift * 0.4, y1 - lift, y1 - lift] });
  const scale = anim.interpolate({ inputRange: stops, outputRange: [1, 1, 0.88, 1, 1, 0.88, 1, 1, 1] });
  const opacity = anim.interpolate({ inputRange: stops, outputRange: [0, 1, 1, 1, 1, 1, 1, 1, 0] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, opacity, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
      <Hand size={handSize} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
});
