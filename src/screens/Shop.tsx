// src/screens/Shop.tsx
//
// The shop. Coins buy battle items (carried into a level and used there), and colours for your side of the battlefield
// (see src/shop.ts). The screen owns no state: App passes progress in and takes buy / equip taps back.

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmeticKind, Progress, coinsLeft, heldOf, upgradeLevel } from '../progress';
import { BOARDS, ITEM_PACKS, ITEM_SHOP, SHAPES, SKINS, TITLES, UPGRADES, packPrice, skinById, type Board, type ItemShop, type Shape, type Skin, type Title, type UpgradeShop } from '../shop';
import { useTheme } from '../theme';
import Button from '../ui/Button';
import Card, { SectionLabel } from '../ui/Card';
import CurrencyPill from '../ui/CurrencyPill';
import { Coin } from '../ui/Decor';
import { SHAPE_ART } from '../ui/sprites';
import ScreenHeader from '../ui/ScreenHeader';
import Stage from '../ui/Stage';
import { FONT_BODY, FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import { FS, SPACE } from '../ui/tokens';

type Props = {
  progress: Progress;
  onBuy: (id: string) => void;
  onEquip: (id: string) => void;
  onBuyItem: (id: string, count: number) => void;
  onBuyUpgrade: (id: string) => void;
  /** Troop shapes, board themes and leaderboard titles: buy, or equip what you own. */
  onBuyCosmetic: (kind: CosmeticKind, id: string) => void;
  onEquipCosmetic: (kind: CosmeticKind, id: string) => void;
  onBack?: () => void;
};

/** A skin on a state: the colour field, a tower and a troop count, like the battlefield. */
function Preview({ skin }: { skin: Skin }) {
  return (
    <View style={[styles.preview, { backgroundColor: skin.light }]} accessibilityLabel={`${skin.name} preview`}>
      <View style={[styles.tower, { backgroundColor: skin.deep }]} />
      <Text style={styles.count}>40</Text>
    </View>
  );
}

function SkinItem({ skin, progress, onBuy, onEquip }: { skin: Skin; progress: Progress; onBuy: Props['onBuy']; onEquip: Props['onEquip'] }) {
  const { theme } = useTheme();
  const owned = progress.skins.includes(skin.id);
  const equipped = progress.skin === skin.id;
  const afford = coinsLeft(progress) >= skin.price;
  return (
    <Card style={styles.item}>
      <Preview skin={skin} />
      <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
        {skin.name}
      </Text>
      {equipped ? (
        <Button label="EQUIPPED" tone="soft" size="sm" fullWidth disabled onPress={() => {}} accessibilityLabel={`${skin.name}, equipped`} />
      ) : owned ? (
        <Button label="EQUIP" tone="blue" size="sm" fullWidth onPress={() => onEquip(skin.id)} accessibilityLabel={`Equip ${skin.name}`} />
      ) : (
        <Button
          label={skin.price.toLocaleString()}
          icon={<Coin size={16} />}
          tone={afford ? 'green' : 'light'}
          size="sm"
          fullWidth
          disabled={!afford}
          onPress={() => onBuy(skin.id)}
          accessibilityLabel={`Buy ${skin.name} for ${skin.price} coins`}
        />
      )}
    </Card>
  );
}

/** One battle item: its picture, what it does, how many you hold, and one-or-five buy buttons. */
function ItemRow({ item, progress, onBuy }: { item: ItemShop; progress: Progress; onBuy: Props['onBuyItem'] }) {
  const { theme } = useTheme();
  const held = heldOf(progress, item.id);
  return (
    <Card style={styles.itemRow}>
      <View style={styles.itemTop}>
        <View style={styles.itemArt} accessibilityLabel={`${item.name} icon`}>
          <Text style={styles.itemEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.itemText}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.name, { color: theme.ink }]}>{item.name}</Text>
            <Text style={[styles.held, { color: theme.inkSoft }]} accessibilityLabel={`You have ${held} ${item.name}`}>{`You have ${held}`}</Text>
          </View>
          <Text style={[styles.note, { color: theme.inkSoft }]}>{item.blurb}</Text>
        </View>
      </View>
      <View style={styles.packs}>
        {ITEM_PACKS.map((count) => {
          const price = packPrice(item, count);
          const afford = coinsLeft(progress) >= price;
          return (
            <View key={count} style={styles.pack}>
              <Button
                label={`×${count}`}
                trailing={
                  <View style={styles.packPrice}>
                    <Coin size={14} />
                    <Text style={[styles.packPriceText, { color: afford ? '#FFFFFF' : theme.ink }, afford && styles.packPriceShadow]}>
                      {price.toLocaleString()}
                    </Text>
                  </View>
                }
                tone={afford ? 'orange' : 'light'}
                size="sm"
                fullWidth
                disabled={!afford}
                onPress={() => onBuy(item.id, count)}
                accessibilityLabel={`Buy ${count} ${item.name} for ${price} coins`}
              />
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** A permanent upgrade: what it gives now, what the next level gives, and one button to buy it. */
function UpgradeRow({ up, progress, onBuy }: { up: UpgradeShop; progress: Progress; onBuy: Props['onBuyUpgrade'] }) {
  const { theme } = useTheme();
  const level = upgradeLevel(progress, up.id);
  const max = up.prices.length;
  const maxed = level >= max;
  const price = maxed ? 0 : up.prices[level];
  const afford = coinsLeft(progress) >= price;
  return (
    <Card style={styles.itemRow}>
      <View style={styles.itemTop}>
        <View style={styles.itemArt} accessibilityLabel={`${up.name} icon`}>
          <Text style={styles.itemEmoji}>{up.emoji}</Text>
        </View>
        <View style={styles.itemText}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.name, { color: theme.ink }]}>{up.name}</Text>
            <Text style={[styles.held, { color: theme.inkSoft }]} accessibilityLabel={`${up.name} level ${level} of ${max}`}>{`Level ${level}/${max}`}</Text>
          </View>
          <Text style={[styles.note, { color: theme.inkSoft }]}>{maxed ? `${up.describe(level)} (maxed)` : `Next: ${up.describe(level + 1)}`}</Text>
        </View>
      </View>
      {maxed ? (
        <Button label="MAXED" tone="soft" size="sm" fullWidth disabled onPress={() => {}} accessibilityLabel={`${up.name}, maxed`} />
      ) : (
        <Button
          label={price.toLocaleString()}
          icon={<Coin size={15} />}
          tone={afford ? 'green' : 'light'}
          size="sm"
          fullWidth
          disabled={!afford}
          onPress={() => onBuy(up.id)}
          accessibilityLabel={`Buy ${up.name} level ${level + 1} for ${price} coins`}
        />
      )}
    </Card>
  );
}

/** A shape, a board or a title: a preview, a name, and one button that buys it, equips it or says it is equipped. */
function CosmeticCard({
  kind,
  id,
  name,
  price,
  preview,
  progress,
  onBuy,
  onEquip,
}: {
  kind: CosmeticKind;
  id: string;
  name: string;
  price: number;
  preview: React.ReactNode;
  progress: Progress;
  onBuy: Props['onBuyCosmetic'];
  onEquip: Props['onEquipCosmetic'];
}) {
  const { theme } = useTheme();
  const owned = (kind === 'shape' ? progress.shapes : kind === 'board' ? progress.boards : progress.titles).includes(id);
  const equipped = (kind === 'shape' ? progress.shape : kind === 'board' ? progress.board : progress.title) === id;
  const afford = coinsLeft(progress) >= price;
  return (
    <Card style={styles.item}>
      {preview}
      <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
        {name}
      </Text>
      {equipped ? (
        <Button label="EQUIPPED" tone="soft" size="sm" fullWidth disabled onPress={() => {}} accessibilityLabel={`${name}, equipped`} />
      ) : owned ? (
        <Button label="EQUIP" tone="blue" size="sm" fullWidth onPress={() => onEquip(kind, id)} accessibilityLabel={`Equip ${name}`} />
      ) : (
        <Button
          label={price.toLocaleString()}
          icon={<Coin size={16} />}
          tone={afford ? 'green' : 'light'}
          size="sm"
          fullWidth
          disabled={!afford}
          onPress={() => onBuy(kind, id)}
          accessibilityLabel={`Buy ${name} for ${price} coins`}
        />
      )}
    </Card>
  );
}

/** A shape drawn in your colour, on a state. */
function ShapePreview({ shape, progress }: { shape: Shape; progress: Progress }) {
  const skin = skinById(progress.skin);
  const art = SHAPE_ART[shape.id];
  return (
    <View style={[styles.preview, { backgroundColor: skin.light }]} accessibilityLabel={`${shape.name} troops preview`}>
      {art ? (
        <Image source={art.card} resizeMode="contain" style={styles.shapeArt} />
      ) : (
        <Text style={[styles.glyph, { color: skin.deep }]}>{`${shape.glyph} ${shape.glyph} ${shape.glyph}`}</Text>
      )}
    </View>
  );
}

/** A board theme: the water, three neutral states and their seams. */
function BoardPreview({ board }: { board: Board }) {
  return (
    <View style={[styles.preview, { backgroundColor: board.water, gap: 5 }]} accessibilityLabel={`${board.name} board preview`}>
      <View style={styles.boardRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.boardCell, { backgroundColor: board.neutral, borderColor: board.seam }]} />
        ))}
      </View>
    </View>
  );
}

/** A leaderboard title badge: its icon in its own tint, or a plain dash for "No title". */
function TitlePreview({ title, theme }: { title: Title; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={[styles.preview, { backgroundColor: theme.cardAlt }]} accessibilityLabel={`${title.name} title preview`}>
      {title.icon ? (
        <Image source={title.icon} resizeMode="contain" style={[styles.titleIcon, { tintColor: title.tint }]} />
      ) : (
        <Text style={[styles.titleNone, { color: theme.muted }]}>—</Text>
      )}
    </View>
  );
}

export default function Shop({ progress, onBuy, onEquip, onBuyItem, onBuyUpgrade, onBuyCosmetic, onEquipCosmetic, onBack }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Stage variant="plain" />
      <ScreenHeader title="Shop" onBack={onBack} right={<CurrencyPill kind="coins" value={coinsLeft(progress)} />} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]} showsVerticalScrollIndicator={false}>
        <SectionLabel>Battle items</SectionLabel>
        <Text style={[styles.note, { color: theme.inkSoft }]}>
          {'Tap the bomb button in a battle to open your items. Use as many as you hold. Each costs about one win.'}
        </Text>
        {ITEM_SHOP.map((i) => (
          <ItemRow key={i.id} item={i} progress={progress} onBuy={onBuyItem} />
        ))}

        <SectionLabel style={styles.second}>Upgrades</SectionLabel>
        <Text style={[styles.note, { color: theme.inkSoft }]}>Permanent, small and capped: a little stronger every battle, never enough to win it for you.</Text>
        {UPGRADES.map((u) => (
          <UpgradeRow key={u.id} up={u} progress={progress} onBuy={onBuyUpgrade} />
        ))}

        <SectionLabel style={styles.second}>Troop colours</SectionLabel>
        <Text style={[styles.note, { color: theme.inkSoft }]}>Recolour your states, towers and troops. Rivals and neutral land keep their colours.</Text>
        <View style={styles.grid}>
          {SKINS.map((s) => (
            <View key={s.id} style={styles.cell}>
              <SkinItem skin={s} progress={progress} onBuy={onBuy} onEquip={onEquip} />
            </View>
          ))}
        </View>

        <SectionLabel style={styles.second}>Titles</SectionLabel>
        <Text style={[styles.note, { color: theme.inkSoft }]}>A badge shown beside your name on the leaderboard. Only the look changes.</Text>
        <View style={styles.grid}>
          {TITLES.map((t) => (
            <View key={t.id} style={styles.cell}>
              <CosmeticCard
                kind="title"
                id={t.id}
                name={t.name}
                price={t.price}
                preview={<TitlePreview title={t} theme={theme} />}
                progress={progress}
                onBuy={onBuyCosmetic}
                onEquip={onEquipCosmetic}
              />
            </View>
          ))}
        </View>

        <SectionLabel style={styles.second}>Troop shapes</SectionLabel>
        <Text style={[styles.note, { color: theme.inkSoft }]}>The shape your troops fly as. Only the look changes.</Text>
        <View style={styles.grid}>
          {SHAPES.map((sh) => (
            <View key={sh.id} style={styles.cell}>
              <CosmeticCard
                kind="shape"
                id={sh.id}
                name={sh.name}
                price={sh.price}
                preview={<ShapePreview shape={sh} progress={progress} />}
                progress={progress}
                onBuy={onBuyCosmetic}
                onEquip={onEquipCosmetic}
              />
            </View>
          ))}
        </View>

        <SectionLabel style={styles.second}>Boards</SectionLabel>
        <Text style={[styles.note, { color: theme.inkSoft }]}>The colours of the battlefield. Only the look changes.</Text>
        <View style={styles.grid}>
          {BOARDS.map((b) => (
            <View key={b.id} style={styles.cell}>
              <CosmeticCard
                kind="board"
                id={b.id}
                name={b.name}
                price={b.price}
                preview={<BoardPreview board={b} />}
                progress={progress}
                onBuy={onBuyCosmetic}
                onEquip={onEquipCosmetic}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.md },
  note: { fontSize: FS.body, fontFamily: FONT_BODY, lineHeight: 19 },
  second: { marginTop: SPACE.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  cell: { width: '47.5%' },
  item: { gap: SPACE.sm, alignItems: 'center' },
  itemRow: { gap: SPACE.sm },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  itemArt: { width: 58, height: 58, borderRadius: 14, backgroundColor: '#3a2618', borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  itemEmoji: { fontSize: 30 },
  itemText: { flex: 1, gap: 2 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  held: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD },
  packs: { flexDirection: 'row', gap: SPACE.sm },
  pack: { flex: 1 },
  packPrice: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: SPACE.sm },
  packPriceText: { fontFamily: FONT_DISPLAY, fontSize: 14 },
  packPriceShadow: { textShadowColor: 'rgba(40,20,5,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  preview: { width: '100%', height: 84, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  tower: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#ffffff' },
  count: { marginTop: 2, fontSize: 14, fontFamily: FONT_DISPLAY, color: '#0b0b0b' },
  glyph: { fontSize: 24, letterSpacing: 2 },
  shapeArt: { width: '100%', height: 76 },
  titleIcon: { width: 40, height: 40 },
  titleNone: { fontSize: 28, fontFamily: FONT_DISPLAY },
  boardRow: { flexDirection: 'row', gap: 4 },
  boardCell: { width: 30, height: 38, borderRadius: 6, borderWidth: 2 },
  name: { fontSize: FS.h3, fontFamily: FONT_DISPLAY },
});
