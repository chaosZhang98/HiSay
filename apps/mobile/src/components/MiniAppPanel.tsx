import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../theme";
import { triggerHaptic } from "../lib/haptic";

/** 小程序元信息：未来由服务端 / A2UI 规范下发，当前为静态示例。 */
export interface MiniAppMeta {
  id: string;
  name: string;
  desc?: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** 图标底色（径向渐变底 + tint 图标色）—— 参考微信小程序圆形 Logo */
  tint: string;
  /** 分组：wechat=已在微信安装的 / recent=最近使用 / agent=Agent生成的 / starred=收藏 */
  group?: "wechat" | "recent" | "agent" | "starred";
}

const MINI_APPS: MiniAppMeta[] = [
  {
    id: "health-diet",
    name: "健康饮食",
    desc: "记录三餐 · 营养分析",
    icon: "nutrition",
    tint: "#34C759",
    group: "agent",
  },
  {
    id: "body-shape",
    name: "身材管理",
    desc: "体重曲线 · 运动计划",
    icon: "fitness-outline",
    tint: "#007AFF",
    group: "agent",
  },
  {
    id: "wechat-ph-1",
    name: "小程序",
    icon: "apps-outline",
    tint: "#8E8E93",
    group: "wechat",
  },
  {
    id: "wechat-ph-2",
    name: "小程序",
    icon: "apps-outline",
    tint: "#8E8E93",
    group: "wechat",
  },
  {
    id: "wechat-ph-3",
    name: "小程序",
    icon: "apps-outline",
    tint: "#8E8E93",
    group: "wechat",
  },
  {
    id: "wechat-ph-4",
    name: "小程序",
    icon: "apps-outline",
    tint: "#8E8E93",
    group: "wechat",
  },
  {
    id: "wechat-ph-5",
    name: "小程序",
    icon: "apps-outline",
    tint: "#8E8E93",
    group: "wechat",
  },
  {
    id: "xiaobai-kaoyan",
    name: "小白考研政治",
    icon: "school-outline",
    tint: "#FF3B30",
    group: "recent",
  },
  {
    id: "shang-an",
    name: "上岸集训营",
    icon: "ribbon-outline",
    tint: "#1C1C1E",
    group: "recent",
  },
  {
    id: "ah-telecom",
    name: "安徽电信",
    icon: "phone-portrait-outline",
    tint: "#FF9500",
    group: "recent",
  },
  {
    id: "smart-todo",
    name: "智能待办",
    icon: "checkmark-circle-outline",
    tint: "#34C759",
    group: "agent",
  },
  {
    id: "more-agent",
    name: "更多",
    desc: "由 Agent 生成",
    icon: "add-outline",
    tint: "#8E8E93",
    group: "agent",
  },
];

/* ==========================================================================
 * 1. 圆形小程序 Logo（参考微信 72pt 圆图 + 品牌色圆底 + 白色图标）
 * ========================================================================== */
function RoundAppIcon({
  size = 72,
  app,
  bordered,
}: {
  size?: number;
  app: MiniAppMeta;
  bordered?: boolean;
}) {
  const inner = app.id === "more-agent" ? (
    <View
      style={[
        styles.placeholderIcon,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Ionicons name={app.icon} size={size * 0.45} color={colors.textTertiary} />
    </View>
  ) : (
    <View
      style={[
        styles.roundIcon,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: app.tint,
        },
      ]}
    >
      <Ionicons name={app.icon} size={size * 0.48} color="#FFFFFF" />
    </View>
  );
  if (!bordered) return inner;
  return (
    <View
      style={{
        width: size + 6,
        height: size + 6,
        borderRadius: (size + 6) / 2,
        padding: 3,
        backgroundColor: "rgba(255,255,255,0.08)",
      }}
    >
      {inner}
    </View>
  );
}

/* ==========================================================================
 * 2. 宫格单元格（4 列）—— 下拉面板 / 全屏中心页通用
 *    视觉：顶部圆形图标 · 下 13pt 次级字 · 浅色简约背景
 * ========================================================================== */
function AppGridCell({
  app,
  onPress,
  iconSize = 64,
}: {
  app: MiniAppMeta;
  onPress?: () => void;
  iconSize?: number;
}) {
  return (
    <TouchableOpacity
      style={styles.gridCell}
      activeOpacity={0.65}
      onPress={() => {
        triggerHaptic("light");
        onPress?.();
      }}
    >
      <RoundAppIcon app={app} size={iconSize} />
      <Text style={styles.gridLabel} numberOfLines={1}>
        {app.name}
      </Text>
    </TouchableOpacity>
  );
}

/* ==========================================================================
 * 3. 下拉面板：浅色简约背景 + 搜索框 + 4×N 宫格 + 点「我的小程序」进全屏
 * ========================================================================== */
export function MiniAppCenter({
  onEnterFullScreen,
}: {
  /** 点击标题进入全屏「我的小程序」中心页 */
  onEnterFullScreen?: () => void;
}) {
  const [active, setActive] = useState<MiniAppMeta | null>(null);
  const [search, setSearch] = useState("");

  const previewList = useMemo(() => {
    // 下拉菜单只展示「最近使用」：4 列紧凑宫格，避免整排灰色占位
    const preferredOrder = [
      "xiaobai-kaoyan",
      "shang-an",
      "ah-telecom",
      "health-diet",
      "body-shape",
      "smart-todo",
      "more-agent",
    ];
    const merged = preferredOrder
      .map((id) => MINI_APPS.find((a) => a.id === id))
      .filter((a): a is MiniAppMeta => Boolean(a));
    const kw = search.trim().toLowerCase();
    if (!kw) return merged;
    return merged.filter((a) => a.name.toLowerCase().includes(kw));
  }, [search]);

  return (
    <View style={styles.sheetPage}>
      <TouchableOpacity
        style={styles.sheetTitleRow}
        activeOpacity={0.55}
        onPress={() => {
          triggerHaptic("medium");
          onEnterFullScreen?.();
        }}
      >
        <Text style={styles.sheetTitle}>我的小程序</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <View style={styles.sheetSearch}>
        <Ionicons
          name="search"
          size={15}
          color={colors.textTertiary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索小程序"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <Text style={styles.sheetSection}>最近使用</Text>
      <View style={styles.sheetGrid}>
        {previewList.map((app) => (
          <AppGridCell
            key={app.id}
            app={app}
            iconSize={52}
            onPress={() => {
              if (app.id === "more-agent") {
                Alert.alert(
                  "更多小程序",
                  "这里的小程序将由 Agent 根据你的需求自动生成（基于 A2UI 设计规范），敬请期待。"
                );
                return;
              }
              setActive(app);
            }}
          />
        ))}
      </View>

      <View style={styles.sheetFooter}>
        <TouchableOpacity style={styles.bottomBarBtn} activeOpacity={0.5}>
          <Ionicons name="star-outline" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
        <Text style={styles.sheetFooterLabel}>小程序</Text>
        <TouchableOpacity style={styles.bottomBarBtn} activeOpacity={0.5}>
          <Ionicons
            name="add-circle-outline"
            size={22}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      <MiniAppFullShell active={active} onClose={() => setActive(null)} />
    </View>
  );
}

/* ==========================================================================
 * 4. 全屏「我的小程序中心」—— 浅色简约
 *    - 顶栏：返回 | 我的小程序 | 空
 *    - 搜索框
 *    - 3 个分组 Tab：最近 / 微信(4) / Agent
 *    - 分组下的 4 列宫格 + 底部分组切换栏
 * ========================================================================== */
export function MyMiniApps({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  type TabKey = "recent" | "wechat" | "agent";
  const [tab, setTab] = useState<TabKey>("wechat");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<MiniAppMeta | null>(null);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "recent", label: "最近使用" },
    { key: "wechat", label: "小程序" },
    { key: "agent", label: "Agent 生成" },
  ];

  const list = useMemo(() => {
    const kw = search.trim().toLowerCase();
    let base = MINI_APPS.filter((a) => a.group === tab);
    if (tab === "wechat") {
      // 参考图是 2 行 × 4 列 = 8 格，不够就占位补
      const placeholders: MiniAppMeta[] = [];
      for (let i = base.length; i < 8; i++) {
        placeholders.push({
          id: `ph-${tab}-${i}`,
          name: "即将上线",
          icon: "apps-outline",
          tint: "#636366",
          group: tab,
        });
      }
      base = [...base, ...placeholders].slice(0, 8);
    }
    if (!kw) return base;
    return base.filter((a) => a.name.toLowerCase().includes(kw));
  }, [tab, search]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalRoot} edges={["top", "bottom"]}>
        <View style={styles.fullscreenInner}>
          {/* 顶栏 */}
          <View style={styles.fullHeader}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic("light");
                onClose();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 36, alignItems: "flex-start" }}
            >
              <Ionicons name="chevron-back" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>我的小程序</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* 搜索框 */}
          <View style={[styles.searchBox, styles.searchBoxFull]}>
            <Ionicons
              name="search"
              size={16}
              color={colors.textTertiary}
              style={{ marginRight: 6 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索小程序"
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* 分组切换 Tab */}
          <View style={styles.segmentedRow}>
            {tabs.map((t, idx) => {
              const selected = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.segmentedItem,
                    idx === 0 && { marginLeft: 0 },
                    selected && styles.segmentedItemActive,
                  ]}
                  activeOpacity={0.55}
                  onPress={() => {
                    triggerHaptic("light");
                    setTab(t.key);
                  }}
                >
                  <Text
                    style={[
                      styles.segmentedText,
                      selected && styles.segmentedTextActive,
                    ]}
                  >
                    {t.label}
                    {t.count ? ` (${t.count})` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 宫格 + vignette */}
          <View style={[styles.gridWrap, styles.gridWrapFull]}>
            <View style={styles.grid4Col}>
              {list.map((app) => (
                <AppGridCell
                  key={app.id}
                  app={app}
                  iconSize={64}
                  onPress={() => {
                    if (app.id.startsWith("ph-")) {
                      Alert.alert("敬请期待", "这个小程序入口还在准备中。");
                      return;
                    }
                    if (app.id === "more-agent") {
                      Alert.alert(
                        "更多小程序",
                        "这里的小程序将由 Agent 根据你的需求自动生成（基于 A2UI 设计规范），敬请期待。"
                      );
                      return;
                    }
                    setActive(app);
                  }}
                />
              ))}
            </View>
      </View>

          {/* 底部分组栏 —— 参考图底部同款 ☆ 微信(4) + */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.bottomBarBtn}
              activeOpacity={0.5}
              onPress={() => {
                triggerHaptic("light");
                Alert.alert("收藏", "收藏的小程序分组稍后上线。");
              }}
            >
              <Ionicons
                name="star-outline"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomBarCenterBtn}
              activeOpacity={0.6}
              onPress={() => setTab("wechat")}
            >
              <Text style={[styles.bottomBarTitle, tab === "wechat" && { color: colors.primary }]}>
                小程序
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomBarBtn}
              activeOpacity={0.5}
              onPress={() => {
                triggerHaptic("light");
                Alert.alert("添加小程序", "由 Agent 根据你的需求自动生成（A2UI 规范），敬请期待。");
              }}
            >
              <Ionicons
                name="add-circle-outline"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <MiniAppFullShell active={active} onClose={() => setActive(null)} />
      </SafeAreaView>
    </Modal>
  );
}

/* ==========================================================================
 * 5. 单个小程序全屏进出场外壳（对标微信：底部滑入 + 右上角胶囊关闭）
 * ========================================================================== */
/** 微信胶囊约 87×32；标题左右各留约 96，避免与行内胶囊撞字。 */
const CAPSULE_HEIGHT = 32;

/** 微信关闭标：圆环套实心小圆，不用普通 X。 */
function WeChatCloseMark({ color }: { color: string }) {
  return (
    <View style={[styles.wechatCloseRing, { borderColor: color }]}>
      <View style={[styles.wechatCloseDot, { backgroundColor: color }]} />
    </View>
  );
}

function MiniAppFullShell({
  active,
  onClose,
}: {
  active: MiniAppMeta | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // fullScreen Modal 里 SafeAreaView 经常量到 insets.top === 0；
  // 用窗口度量 / iOS 刘海下限兜底，把自定义 UI 压到状态栏下方。
  const topInset =
    insets.top > 0
      ? insets.top
      : initialWindowMetrics?.insets.top || (Platform.OS === "ios" ? 47 : 0);

  return (
    <Modal
      visible={active !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.shellRoot,
          { paddingTop: topInset, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.shellNav}>
          <Text style={styles.shellNavTitle} numberOfLines={1}>
            {active?.name ?? ""}
          </Text>
          <View style={styles.shellCapsuleAnchor}>
            <View style={styles.shellCapsule}>
              <TouchableOpacity
                style={styles.shellCapsuleBtn}
                activeOpacity={0.5}
                onPress={() => {
                  triggerHaptic("light");
                  Alert.alert("更多", "小程序菜单稍后上线。");
                }}
                accessibilityLabel="更多"
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={16}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
              <View style={styles.shellCapsuleDivider} />
              <TouchableOpacity
                style={styles.shellCapsuleBtn}
                activeOpacity={0.5}
                onPress={() => {
                  triggerHaptic("medium");
                  onClose();
                }}
                accessibilityLabel="关闭小程序"
              >
                <WeChatCloseMark color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.shellScroll}
          contentContainerStyle={styles.shellScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {active?.desc ? (
            <Text style={styles.shellDesc}>{active.desc}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ==========================================================================
 * StyleSheet
 * ========================================================================== */
const styles = StyleSheet.create({
  /* ---- 下拉面板：贴合主页暖米白的紧凑卡片 ---- */
  sheetPage: {
    flex: 1,
    backgroundColor: colors.home.bg,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.home.title,
  },
  sheetSearch: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.home.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.home.inputBorder,
  },
  sheetSection: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "500",
    color: colors.home.tertiary,
    letterSpacing: 0.4,
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sheetFooter: {
    marginTop: 8,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sheetFooterLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textTertiary,
  },

  /* ---- 全屏中心页沿用原结构 ---- */
  immersivePage: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden",
    paddingHorizontal: 16,
  },
  immersiveTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
  },
  immersiveTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },

  /* ---- 搜索框 ---- */
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchBoxFull: { marginTop: 6, marginHorizontal: 4 },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
  },

  /* ---- 宫格 4 列 ---- */
  gridWrap: {
    marginTop: 18,
    position: "relative",
    minHeight: 160,
    flex: 1,
  },
  gridWrapFull: { marginTop: 18 },
  grid4Col: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridCell: {
    width: "25%",
    alignItems: "center",
    marginBottom: 14,
  },
  gridLabel: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  roundIcon: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8A7A6A",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  placeholderIcon: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,120,128,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },

  /* ---- 底部分组栏：「☆  微信(4)  ⊕」---- */
  bottomBar: {
    marginTop: 4,
    marginHorizontal: -16,
    height: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomBarBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBarCenterBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  bottomBarTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  /* ---- 全屏 Modal 中心页 ---- */
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullscreenInner: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fullHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  fullHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  /* ---- 分组切换 Tab（3 项分段）---- */
  segmentedRow: {
    marginTop: 14,
    flexDirection: "row",
    paddingHorizontal: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,120,128,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginLeft: 8, // RN 替代 gap:8 —— 渲染时第一个 item 需要清零
  },
  segmentedItemActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  segmentedText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  segmentedTextActive: {
    color: colors.primaryDeep,
    fontWeight: "600",
  },

  /* ---- 小程序进出场外壳：状态栏留空 + 44pt 导航行 + 行内胶囊 ---- */
  shellRoot: {
    flex: 1,
    backgroundColor: colors.home.bg,
  },
  shellNav: {
    height: 44,
    justifyContent: "center",
    backgroundColor: colors.home.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  shellNavTitle: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    paddingHorizontal: 96,
  },
  shellCapsuleAnchor: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  shellCapsule: {
    flexDirection: "row",
    alignItems: "center",
    height: CAPSULE_HEIGHT,
    borderRadius: CAPSULE_HEIGHT / 2,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.22)",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOpacity: 0.08,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 0.5 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  shellCapsuleBtn: {
    width: 43,
    height: CAPSULE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  shellCapsuleDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: "rgba(60,60,67,0.22)",
  },
  wechatCloseRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  wechatCloseDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
  },
  shellScroll: {
    flex: 1,
    backgroundColor: colors.home.bg,
  },
  shellScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    minHeight: 1400,
  },
  shellDesc: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
