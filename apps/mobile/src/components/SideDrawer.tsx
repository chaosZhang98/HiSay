import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ConversationItem } from "@agent/shared";
import { Avatar } from "./Avatar";
import { colors, radius, spacing } from "../theme";

const DRAWER_WIDTH_RATIO = 0.82;

export interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  conversations: ConversationItem[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onConversationActions?: (item: { id: string; title: string }) => void;
  /** 抽屉显示/隐藏变化时（用于外部 haptic 等副作用） */
  onVisibilityChange?: (visible: boolean) => void;
  onNewConversation: () => void;
  onOpenTasks: () => void;
  onOpenArchive: () => void;
  onAbout: () => void;
}

/** 左侧抽屉菜单：用户区 + 功能入口 + 历史会话（Kimi 风格）。 */
export function SideDrawer({
  visible,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onConversationActions,
  onVisibilityChange,
  onNewConversation,
  onOpenTasks,
  onOpenArchive,
  onAbout,
}: SideDrawerProps) {
  const width = useMemo(
    () => Dimensions.get("window").width * DRAWER_WIDTH_RATIO,
    []
  );
  const translate = useRef(new Animated.Value(-width)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const shownRef = useRef(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) {
      setSearch("");
      Animated.parallel([
        Animated.timing(translate, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlay, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !shownRef.current) {
          shownRef.current = true;
          onVisibilityChange?.(true);
        }
      });
    } else {
      Animated.parallel([
        Animated.timing(translate, {
          toValue: -width,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlay, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && shownRef.current) {
          shownRef.current = false;
          onVisibilityChange?.(false);
        }
      });
    }
  }, [visible, translate, overlay, width, onVisibilityChange]);

  const keyword = search.trim();
  const filtered = keyword
    ? conversations.filter((c) => c.title.includes(keyword))
    : conversations;

  const menuItems = [
    { id: "tasks", icon: "time-outline" as const, label: "定时任务", onPress: onOpenTasks },
    { id: "archive", icon: "archive-outline" as const, label: "归档消息", onPress: onOpenArchive },
    { id: "about", icon: "information-circle-outline" as const, label: "关于", onPress: onAbout },
  ];

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* 遮罩：点击关闭 */}
        <Animated.View style={[styles.overlay, { opacity: overlay }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        {/* 抽屉主体 */}
        <Animated.View style={[styles.drawer, { width, transform: [{ translateX: translate }] }]}>
          <SafeAreaView style={styles.drawerInner} edges={["top", "left", "bottom"]}>
            {/* 用户区 */}
            <View style={styles.userRow}>
              <Avatar role="user" size={40} />
              <Text style={styles.userName} numberOfLines={1}>
                Agent 用户
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>v0.1</Text>
              </View>
            </View>

            {/* 功能入口 */}
            <View style={styles.menuGroup}>
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.5}
                >
                  <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 历史会话 */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>历史会话</Text>
            </View>
            <TouchableOpacity style={styles.newConvButton} onPress={onNewConversation} activeOpacity={0.5}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.newConvText}>新建对话</Text>
            </TouchableOpacity>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={styles.convList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.id === activeConversationId;
                return (
                  <View
                    style={[styles.convItem, active && styles.convItemActive]}
                  >
                    <TouchableOpacity
                      style={styles.convMain}
                      onPress={() => onSelectConversation(item.id)}
                      onLongPress={() =>
                        onConversationActions?.({
                          id: item.id,
                          title: item.title,
                        })
                      }
                      activeOpacity={0.5}
                    >
                      <Text
                        style={[
                          styles.convTitle,
                          active && styles.convTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {active && <View style={styles.convDot} />}
                    </TouchableOpacity>
                    {onConversationActions ? (
                      <TouchableOpacity
                        style={styles.convMoreButton}
                        onPress={() =>
                          onConversationActions({
                            id: item.id,
                            title: item.title,
                          })
                        }
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.4}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color={colors.textTertiary}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {keyword ? "没有匹配的会话" : "暂无历史会话"}
                </Text>
              }
            />

            {/* 底部搜索 */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="搜索会话"
                  placeholderTextColor={colors.textTertiary}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
    backgroundColor: colors.background,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 8, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 16,
    },
  },
  drawerInner: { flex: 1 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  userName: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: "rgba(120,120,128,0.12)",
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  menuGroup: { paddingHorizontal: spacing.sm },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  menuLabel: {
    marginLeft: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  sectionRow: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.textTertiary },
  newConvButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  newConvText: {
    marginLeft: spacing.sm,
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  convList: { flex: 1, paddingHorizontal: spacing.sm },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  convMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  convMoreButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  convItemActive: { backgroundColor: colors.primarySoft },
  convTitle: { flex: 1, fontSize: 15, color: colors.textPrimary },
  convTitleActive: { color: colors.primary, fontWeight: "600" },
  convDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: spacing.sm,
    backgroundColor: colors.primary,
  },
  emptyText: {
    textAlign: "center",
    marginTop: spacing.xl,
    fontSize: 13,
    color: colors.textTertiary,
  },
  searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: "rgba(120,120,128,0.1)",
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
