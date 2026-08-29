import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "../store/chat-store";
import { wsClient } from "../lib/websocket-client";
import AgentMarkdown from "../components/AgentMarkdown";
import { Avatar } from "../components/Avatar";
import { TypingIndicator } from "../components/TypingIndicator";
import { SideDrawer } from "../components/SideDrawer";
import PullDownMenu, { PullDownMenuHandle } from "../components/PullDownMenu";
import { MiniAppCenter, MyMiniApps } from "../components/MiniAppPanel";
import { colors, radius, spacing, shadows, typography } from "../theme";
import { triggerHaptic } from "../lib/haptic";
import {
  requestNotificationPermission,
  showTaskResultNotification,
} from "../lib/notifications";

const WS_URL = "ws://192.168.0.100:8080";
const DEVICE_ID = "ios-device-1";

interface DisplayMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt?: string;
}

/** 消息时间：当天显示 HH:mm，跨天显示日期。 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatScreen({
  onOpenTasks,
}: {
  onOpenTasks?: () => void;
}) {
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(
    null
  );
  const [renameInput, setRenameInput] = useState("");
  const [archivedVisible, setArchivedVisible] = useState(false);
  // 全屏「我的小程序」中心页（下拉面板点击标题 < 我的小程序 进入）
  const [myMiniAppsVisible, setMyMiniAppsVisible] = useState(false);
  // 左侧抽屉菜单
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 顶部下拉小程序面板：FlatList 是否在顶部 + 面板打开时禁用列表滚动
  const listAtTopRef = useRef(true);
  const [pullScrollEnabled, setPullScrollEnabled] = useState(true);
  const miniAppMenuRef = useRef<PullDownMenuHandle>(null);
  // 左边缘右滑手势（左拉）：从屏幕左边缘约 40pt 内向右滑唤出抽屉（热区更宽，降低误判）
  const edgeStartX = useRef(0);
  const edgePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (e) => {
          edgeStartX.current = e.nativeEvent.pageX;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          edgeStartX.current < 40 && g.dx > 12 && Math.abs(g.dy) < 18,
        onPanResponderGrant: () => setDrawerOpen(true),
      }),
    []
  );

  // 注意：之前的"首次 peek 引导"（半开下拉面板 40% 收回）已按产品要求移除。
  // 用户语义：常态下小程序面板**完全隐藏**，不存在任何半开"暗示态"，
  // 唯一的中间态是用户手指从屏幕顶部边缘下拉过程本身（松手即 threshold 回弹）。
  const {
    messages,
    conversations,
    archivedMessages,
    connectionStatus,
    isStreaming,
    streamingMessageId,
    conversationId,
    addMessage,
    appendMessage,
    appendDelta,
    finishStreaming,
    loadSession,
    loadConversations,
    upsertConversation,
    setConnectionStatus,
    clearMessages,
    toggleConversationList,
    loadArchivedMessages,
    clearArchivedMessages,
    setStreaming,
  } = useChatStore();

  useEffect(() => {
    wsClient.setListeners({
      onStatusChange: (status) => {
        setConnectionStatus(status);
        // 连接成功后拉取会话列表
        if (status === "connected") {
          wsClient.fetchConversations();
        }
      },
      onDelta: (delta, messageId) => {
        appendDelta(delta, messageId);
      },
      onComplete: (messageId) => {
        finishStreaming(messageId);
      },
      onError: (_code, message) => {
        console.error("Agent error:", message);
        setStreaming(false);
      },
      onTaskResult: (result) => {
        showTaskResultNotification(result);
      },
      // 定时任务执行结论回写当前会话：追加一条 agent 消息实时显示
      onTaskResultMessage: (convId, message) => {
        if (convId === useChatStore.getState().conversationId) {
          appendMessage({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          });
        }
      },
      // 服务端注册/新建会话后返回会话 ID 与历史消息，恢复/初始化对话
      onSession: (convId, history) => {
        loadSession(
          convId,
          history.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
      },
      // 切换会话后返回目标会话的历史消息
      onHistory: (convId, history) => {
        loadSession(
          convId,
          history.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
      },
      onConversationList: (list) => {
        loadConversations(list);
      },
      // 重命名/删除会话后同步列表
      onConversationChanged: (conv, deleted) => {
        if (deleted) {
          upsertConversation(conv, true);
          if (conv.id === useChatStore.getState().conversationId) {
            clearMessages();
            useChatStore.setState({ conversationId: "" });
          }
        } else {
          upsertConversation(conv);
        }
      },
      onArchivedMessages: (convId, history) => {
        loadArchivedMessages(convId, history);
      },
    });

    requestNotificationPermission();

    wsClient.connect(WS_URL, DEVICE_ID);

    return () => {
      wsClient.disconnect();
    };
  }, []);

  const handleSend = () => {
    const text = input.trim();
    // 等待服务端 session_info 提供会话 ID 后才能发送
    if (!text || isStreaming || !conversationId) return;

    const msgId = crypto.randomUUID();
    addMessage({ id: msgId, role: "user", content: text, createdAt: new Date().toISOString() });
    setInput("");

    // 创建空的 agent 消息占位
    const agentMsgId = crypto.randomUUID();
    addMessage({ id: agentMsgId, role: "agent", content: "", createdAt: new Date().toISOString() });
    setStreaming(true);
    useChatStore.setState({ streamingMessageId: agentMsgId });

    wsClient.sendMessage(conversationId, text);
  };

  // 切换会话：先清空当前消息，再向服务端拉取该会话历史
  const handleSelectConversation = (convId: string) => {
    toggleConversationList(false);
    if (convId === conversationId) return;
    clearMessages();
    wsClient.fetchHistory(convId);
  };

  // 新建会话：清空当前消息，服务端创建后返回新的 session_info
  const handleNewConversation = () => {
    toggleConversationList(false);
    clearMessages();
    wsClient.createConversation();
  };

  // 打开重命名弹窗
  const startRename = (item: { id: string; title: string }) => {
    setRenaming(item);
    setRenameInput(item.title);
  };

  const submitRename = () => {
    if (!renaming || !renameInput.trim()) return;
    wsClient.renameConversation(renaming.id, renameInput.trim());
    setRenaming(null);
  };

  // 打开归档消息
  const openArchive = (convId: string) => {
    setArchivedVisible(true);
    clearArchivedMessages();
    wsClient.fetchArchivedMessages(convId);
  };

  const currentTitle =
    conversations.find((c) => c.id === conversationId)?.title ?? "新对话";

  // ---- 主页面（空会话）专属 ----
  const home = messages.length === 0;

  // 语音静音 / 开启（纯视觉占位，不破坏交互契约）
  const [soundOff, setSoundOff] = useState(true);

  // 语音按钮占位：不改变发送契约，点它直接报"占位功能"
  const onVoicePress = () => {
    triggerHaptic("medium");
    Alert.alert("语音输入", "语音输入功能即将上线，敬请期待。");
  };

  // 新建对话左 +：填入输入框并立即发送
  const onHomePlus = () => {
    triggerHaptic("light");
    Alert.alert("提示", "直接在下方输入你想问的内容。");
  };

  const renderMessage = ({ item }: { item: DisplayMessage }) => {
    const isUser = item.role === "user";
    const isStreamingMsg = item.id === streamingMessageId;
    const showTyping = !isUser && isStreamingMsg && !item.content;

    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && <Avatar role="agent" size={30} />}
        <View style={[styles.msgWrap, isUser && styles.msgWrapUser]}>
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.agentBubble]}>
            {isUser ? (
              <Text style={styles.userText}>{item.content}</Text>
            ) : showTyping ? (
              <TypingIndicator />
            ) : (
              <AgentMarkdown>{item.content}</AgentMarkdown>
            )}
          </View>
          {item.createdAt ? (
            <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>
              {formatTime(item.createdAt)}
            </Text>
          ) : null}
        </View>
        {isUser && <Avatar role="user" size={30} />}
      </View>
    );
  };

  const renderArchivedMessage = ({
    item,
  }: {
    item: { id: string; role: "user" | "agent"; content: string; createdAt: string };
  }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && <Avatar role="agent" size={30} />}
        <View style={[styles.msgWrap, isUser && styles.msgWrapUser]}>
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.agentBubble]}>
            {isUser ? (
              <Text style={styles.userText}>{item.content}</Text>
            ) : (
              <AgentMarkdown>{item.content}</AgentMarkdown>
            )}
          </View>
          <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
        {isUser && <Avatar role="user" size={30} />}
      </View>
    );
  };

  return (
    <View
      style={[styles.flex1, home && styles.homeRoot]}
      {...edgePan.panHandlers}
    >
      <PullDownMenu
        ref={miniAppMenuRef}
        title="小程序"
        menuContent={
          <MiniAppCenter
            onEnterFullScreen={() => {
              // 收起下拉面板后，打开全屏「我的小程序」中心
              miniAppMenuRef.current?.close();
              // 下一帧打开，避免两个动画冲突
              setTimeout(() => setMyMiniAppsVisible(true), 180);
            }}
          />
        }
        atTopRef={listAtTopRef}
        onScrollDisabled={setPullScrollEnabled}
        // 面板高度 = 整屏高度：下拉后直达屏幕底部，而不是悬浮半空的卡片
        panelHeight={Dimensions.get("window").height}
      >
        <SafeAreaView
          style={[styles.container, home && styles.homeContainer]}
          edges={["top"]}
        >
          {/* ============ 顶部导航（空会话时为 Kimi 深色主页顶栏） ============ */}
          {home ? (
            <View style={styles.homeHeader}>
              {/* 左侧：☰ + 蓝点 */}
              <View style={styles.homeHeaderLeft}>
                <TouchableOpacity
                  style={styles.homeMenuButton}
                  onPress={() => {
                    wsClient.fetchConversations();
                    triggerHaptic("light");
                    setDrawerOpen(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.55}
                >
                  <Ionicons name="menu" size={22} color={colors.home.iconTint} />
                  <View style={styles.homeMenuDot} />
                </TouchableOpacity>
              </View>

              {/* 右侧：语音静音 */}
              <TouchableOpacity
                style={styles.homeSoundButton}
                onPress={() => {
                  setSoundOff((v) => !v);
                  triggerHaptic("light");
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.55}
              >
                <Ionicons
                  name={soundOff ? "volume-mute" : "volume-medium"}
                  size={22}
                  color={colors.home.iconTint}
                />
                <View style={styles.homeSoundOffBadge} pointerEvents="none" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <TouchableOpacity
                  style={styles.menuEntryButton}
                  onPress={() => {
                    wsClient.fetchConversations();
                    triggerHaptic("light");
                    setDrawerOpen(true);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="menu" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {currentTitle}
                </Text>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    triggerHaptic("medium");
                    handleNewConversation();
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="add" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 连接状态指示器（home 下贴在顶栏下方，暗色背景） */}
          {connectionStatus !== "connected" && (
            <View
              style={[
                styles.statusChip,
                home && styles.statusChipDark,
                connectionStatus === "reconnecting"
                  ? styles.statusReconnecting
                  : styles.statusDisconnected,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  connectionStatus === "reconnecting"
                    ? styles.statusDotWarn
                    : styles.statusDotDanger,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  home && { color: colors.textSecondary },
                ]}
              >
                {connectionStatus === "reconnecting" ? "重连中..." : "未连接"}
              </Text>
            </View>
          )}

          <KeyboardAvoidingView
            style={styles.chatArea}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            {/* ============ 空会话：Kimi 风格主页面 ============ */}
            {home ? (
              <View style={styles.homeBody} pointerEvents="box-none">
                {/* 中部：吉祥物 + 问候 */}
                <View style={styles.homeMascotWrap} pointerEvents="none">
                  <View style={styles.homeMascotOuter}>
                    <View style={styles.homeMascotCore}>
                      <View
                        style={[
                          styles.homeMascotEye,
                          styles.homeMascotEyeLeft,
                        ]}
                      />
                      <View
                        style={[
                          styles.homeMascotEye,
                          styles.homeMascotEyeRight,
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* 占位推高，让吉祥物居中 */}
                <View style={{ flex: 1 }} />

                {/* 大输入胶囊（＋ 左｜占位｜语音 右） + AI 免责 */}
                <View style={styles.homeInputWrap}>
                  <View style={styles.homeInputCapsule}>
                    <TouchableOpacity
                      style={styles.homeInputPlus}
                      onPress={onHomePlus}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="add" size={22} color={colors.home.iconTint} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.homeInput}
                      value={input}
                      onChangeText={setInput}
                      placeholder="尽管问..."
                      placeholderTextColor={colors.home.placeholder}
                      editable={!isStreaming}
                      returnKeyType="send"
                      onSubmitEditing={handleSend}
                      multiline={false}
                    />
                    <TouchableOpacity
                      style={styles.homeInputVoice}
                      onPress={onVoicePress}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="mic" size={20} color={colors.home.iconTint} />
                    </TouchableOpacity>
                  </View>
                  {/* 输入内容时显示发送按钮（覆盖"语音"）：保持发送契约不被破坏 */}
                  {input.trim() ? (
                    <TouchableOpacity
                      style={styles.homeSendButton}
                      onPress={handleSend}
                      disabled={isStreaming || !conversationId}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="arrow-up"
                        size={18}
                        color={colors.onPrimary}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.homeDisclaimer}>内容由 AI 生成</Text>
                </View>
              </View>
            ) : (
              /* ============ 有消息：原有对话视图（契约 100% 保留） ============ */
              <>
                <FlatList
                  ref={flatListRef}
                  data={[...messages].reverse()}
                  renderItem={renderMessage}
                  keyExtractor={(item) => item.id}
                  style={styles.messageList}
                  contentContainerStyle={styles.messageListContent}
                  inverted
                  scrollEnabled={pullScrollEnabled}
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    listAtTopRef.current =
                      e.nativeEvent.contentOffset.y <= 2;
                  }}
                  onContentSizeChange={() =>
                    flatListRef.current?.scrollToOffset({
                      offset: 0,
                      animated: true,
                    })
                  }
                />

                {/* 输入区域 */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="输入消息..."
                    placeholderTextColor={colors.textTertiary}
                    editable={!isStreaming}
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!input.trim() || isStreaming) &&
                        styles.sendButtonDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={!input.trim() || isStreaming}
                  >
                    <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>

      {/* 归档消息 */}
      <Modal
        visible={archivedVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setArchivedVisible(false)}
      >
        <SafeAreaView style={styles.modal} edges={["top"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>归档消息</Text>
            <TouchableOpacity
              onPress={() => setArchivedVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {archivedMessages === null ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>加载中...</Text>
            </View>
          ) : (
            <FlatList
              data={archivedMessages.messages}
              renderItem={renderArchivedMessage}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>该会话暂无归档消息</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* 重命名会话 */}
      <Modal
        visible={renaming !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setRenaming(null)}
      >
        <View style={styles.renameOverlay}>
          <View style={styles.renameDialog}>
            <Text style={styles.renameTitle}>重命名会话</Text>
            <TextInput
              style={styles.renameInput}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              maxLength={50}
              placeholder="输入新名称"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancel}
                onPress={() => setRenaming(null)}
              >
                <Text style={styles.renameCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.renameConfirm,
                  !renameInput.trim() && styles.renameConfirmDisabled,
                ]}
                onPress={submitRename}
                disabled={!renameInput.trim()}
              >
                <Text style={styles.renameConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 左侧抽屉菜单 */}
      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={(id) => {
          setDrawerOpen(false);
          handleSelectConversation(id);
        }}
        onNewConversation={() => {
          setDrawerOpen(false);
          handleNewConversation();
        }}
        onOpenTasks={() => {
          setDrawerOpen(false);
          onOpenTasks?.();
        }}
        onOpenArchive={() => {
          setDrawerOpen(false);
          if (!conversationId) {
            Alert.alert("提示", "当前没有会话，先发一条消息创建会话");
            return;
          }
          openArchive(conversationId);
        }}
        onVisibilityChange={(v) => triggerHaptic(v ? "light" : "medium")}
        onConversationActions={(item) => {
          triggerHaptic("warning");
          setDrawerOpen(false);
          Alert.alert(item.title, "选择操作", [
            { text: "取消", style: "cancel" },
            {
              text: "重命名",
              onPress: () => startRename(item),
            },
            {
              text: "归档",
              onPress: () => openArchive(item.id),
            },
            {
              text: "删除",
              style: "destructive",
              onPress: () => {
                if (item.id === conversationId) clearMessages();
                wsClient.deleteConversation(item.id);
              },
            },
          ]);
        }}
        onAbout={() => {
          setDrawerOpen(false);
          Alert.alert("关于", "Agent iOS v0.1.0\n基于 MiMo 2.5 Pro");
        }}
      />
      </SafeAreaView>
    </PullDownMenu>

      {/* 全屏·我的小程序中心 Modal */}
      <MyMiniApps
        visible={myMiniAppsVisible}
        onClose={() => setMyMiniAppsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  // ---- 顶部导航 ----
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: "rgba(252,248,244,0.92)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  menuEntryButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  headerTitle: { flex: 1, ...typography.header },
  headerButtons: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(120,120,128,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  // ---- 连接状态 ----
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusReconnecting: { backgroundColor: colors.warningSoft },
  statusDisconnected: { backgroundColor: colors.dangerSoft },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  statusDotWarn: { backgroundColor: colors.warning },
  statusDotDanger: { backgroundColor: colors.danger },
  statusText: { fontSize: 12, color: colors.textSecondary },
  // ---- 消息区 ----
  chatArea: { flex: 1 },
  messageList: { flex: 1 },
  messageListContent: { padding: spacing.md },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  msgRowUser: { justifyContent: "flex-end" },
  msgWrap: {
    marginHorizontal: spacing.sm,
    maxWidth: "78%",
    alignItems: "flex-start",
  },
  msgWrapUser: { alignItems: "flex-end" },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  agentBubble: {
    backgroundColor: colors.agentBubble,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 18,
    ...shadows.bubble,
  },
  userText: { fontSize: 15, lineHeight: 20, color: colors.onPrimary },
  msgTime: { fontSize: 10, color: colors.textTertiary, marginTop: 3, marginHorizontal: 2 },
  msgTimeUser: { color: colors.textSecondary },
  // ---- 输入区 ----
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: { backgroundColor: colors.disabled },
  // ---- 弹窗通用 ----
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.header },
  list: { flex: 1 },
  listContent: { padding: spacing.md },
  // ---- 会话列表项 ----
  convItem: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: "transparent",
    ...shadows.card,
  },
  convItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  convMain: { flexDirection: "row", alignItems: "center" },
  convIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(120,120,128,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  convIconActive: { backgroundColor: colors.primarySoft },
  convBody: { flex: 1 },
  convHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  convTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  convTime: { fontSize: 11, color: colors.textTertiary, marginLeft: spacing.sm },
  convPreview: { marginTop: 2, fontSize: 13, color: colors.textSecondary },
  convActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  convAction: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.lg,
  },
  convActionText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "500",
    marginLeft: 3,
  },
  convActionDanger: { color: colors.danger },
  // ---- 空状态 ----
  emptyState: {
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyHint: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
  },
  // ---- 新建会话 ----
  newConversationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  newConversationButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 4,
  },
  // ---- 重命名弹窗 ----
  renameOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: 32,
  },
  renameDialog: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: spacing.xl,
    ...shadows.card,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  renameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.lg,
  },
  renameCancel: { paddingHorizontal: 14, paddingVertical: 8 },
  renameCancelText: { fontSize: 15, color: colors.textSecondary },
  renameConfirm: {
    marginLeft: spacing.sm,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  renameConfirmDisabled: { backgroundColor: colors.disabled },
  renameConfirmText: { fontSize: 15, color: colors.onPrimary, fontWeight: "600" },
  // ---- 主页面（Kimi 深色壳） ----
  homeRoot: { flex: 1 },
  homeContainer: { flex: 1, backgroundColor: colors.home.bg },
  statusChipDark: { backgroundColor: colors.home.surface },
  // 顶栏
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
  },
  homeHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  homeMenuButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.home.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  homeMenuDot: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.home.dot,
  },
  homeSoundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.home.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  homeSoundOffBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.75)",
    transform: [{ rotate: "-45deg" }],
    borderRadius: 1,
  },
  // 中部吉祥物
  homeBody: { flex: 1, paddingHorizontal: spacing.md },
  homeMascotWrap: {
    marginTop: 68,
    alignSelf: "center",
  },
  homeMascotOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.home.mascot,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,138,61,0.45)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  homeMascotCore: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.home.mascotInner,
    position: "relative",
  },
  homeMascotEye: {
    position: "absolute",
    top: 20,
    width: 12,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.home.mascotEye,
  },
  homeMascotEyeLeft: { left: 16 },
  homeMascotEyeRight: { right: 16 },
  // 底部大输入胶囊 + 免责
  homeInputWrap: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: "stretch",
  },
  homeInputCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.home.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.home.inputBorder,
    borderRadius: 30,
    paddingHorizontal: 6,
    height: 60,
  },
  homeInputPlus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.home.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  homeInput: {
    flex: 1,
    marginHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 17,
    color: colors.home.title,
  },
  homeInputVoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.home.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  homeSendButton: {
    position: "absolute",
    right: spacing.md + 6,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  homeDisclaimer: {
    marginTop: 8,
    alignSelf: "center",
    fontSize: 12,
    color: colors.home.tertiary,
  },
});
