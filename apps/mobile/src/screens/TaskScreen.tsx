import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Button as TButton,
  Input as TInput,
  TextArea as TTextArea,
  Switch as TSwitch,
  Text as TText,
  XStack,
} from "tamagui";
import { useChatStore } from "../store/chat-store";
import { restApi } from "../lib/rest-api";
import type { ScheduledTaskItem, TaskRunItem } from "@hisay/shared";
import { colors, radius, spacing, shadows, typography } from "../theme";

export default function TaskScreen({ onBack }: { onBack: () => void }) {
  const { tasks, taskRuns, loadTasks, upsertTask, loadTaskRuns } = useChatStore();

  const [createVisible, setCreateVisible] = useState(false);
  const [cronInput, setCronInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [historyVisible, setHistoryVisible] = useState(false);

  useEffect(() => {
    void restApi.listTasks().then((result) => loadTasks(result.tasks));
  }, [loadTasks]);

  const handleCreate = () => {
    const cron = cronInput.trim();
    const prompt = promptInput.trim();
    if (!cron || !prompt) return;
    void restApi.createTask(cron, prompt).then((result) => upsertTask(result.task));
    setCronInput("");
    setPromptInput("");
    setCreateVisible(false);
  };

  const openHistory = (taskId: string) => {
    void restApi.taskRuns(taskId).then((result) => loadTaskRuns(taskId, result.runs));
    setHistoryVisible(true);
  };

  const renderTask = ({ item }: { item: ScheduledTaskItem }) => (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskIcon}>
          <Ionicons name="alarm-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.taskPrompt} numberOfLines={2}>
          {item.prompt}
        </Text>
        <View
          style={[
            styles.taskStatusBadge,
            item.isEnabled ? styles.taskStatusOn : styles.taskStatusOff,
          ]}
        >
          <Text
            style={[
              styles.taskStatusText,
              item.isEnabled ? styles.taskStatusTextOn : styles.taskStatusTextOff,
            ]}
          >
            {item.isEnabled ? "启用" : "停用"}
          </Text>
        </View>
      </View>

      <View style={styles.taskMeta}>
        <Text style={styles.taskCron}>{item.cronExpression}</Text>
        {item.lastRunAt ? (
          <Text style={styles.taskTime}>
            上次运行 {new Date(item.lastRunAt).toLocaleString()}
          </Text>
        ) : null}
      </View>

      <View style={styles.taskActions}>
        <View style={styles.taskToggle}>
          <TText fontSize={13} color={colors.textSecondary} mr={6}>
            启用
          </TText>
          <TSwitch
            size="$2"
            checked={item.isEnabled}
            onCheckedChange={() => {
              void restApi.toggleTask(item.id).then((result) => upsertTask(result.task));
            }}
            backgroundColor={colors.primary}
            borderColor={colors.primary}
          >
            <TSwitch.Thumb animation="quick" />
          </TSwitch>
        </View>
        <View style={styles.taskActionGroup}>
          <TButton
            size="$2"
            chromeless
            borderRadius={radius.md}
            backgroundColor={colors.primarySoft}
            paddingHorizontal={10}
            icon={<Ionicons name="time-outline" size={15} color={colors.primary} />}
            onPress={() => openHistory(item.id)}
          >
            <TText fontSize={13} color={colors.primary} fontWeight="500">
              历史
            </TText>
          </TButton>
          <TButton
            size="$2"
            chromeless
            marginLeft={spacing.sm}
            borderRadius={radius.md}
            backgroundColor={colors.dangerSoft}
            paddingHorizontal={10}
            icon={<Ionicons name="trash-outline" size={15} color={colors.danger} />}
            onPress={() => {
              void restApi.deleteTask(item.id).then(() => upsertTask(item, true));
            }}
          >
            <TText fontSize={13} color={colors.danger} fontWeight="500">
              删除
            </TText>
          </TButton>
        </View>
      </View>
    </View>
  );

  const renderRun = ({ item }: { item: TaskRunItem }) => (
    <View style={styles.runCard}>
      <View style={styles.runHeader}>
        <View
          style={[
            styles.runStatusDot,
            item.status === "success"
              ? styles.runDotSuccess
              : item.status === "failed"
                ? styles.runDotFailed
                : styles.runDotRunning,
          ]}
        />
        <Text
          style={[
            styles.runStatus,
            item.status === "success"
              ? styles.runSuccess
              : item.status === "failed"
                ? styles.runFailed
                : styles.runRunning,
          ]}
        >
          {item.status === "success" ? "成功" : item.status === "failed" ? "失败" : "运行中"}
        </Text>
        <Text style={styles.runTime}>{new Date(item.runAt).toLocaleString()}</Text>
      </View>
      {item.output ? (
        <Text style={styles.runOutput} numberOfLines={6}>
          {item.output}
        </Text>
      ) : null}
      {item.error ? <Text style={styles.runError}>{item.error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>定时任务</Text>
        <TButton
          size="$3"
          backgroundColor={colors.primary}
          color={colors.onPrimary}
          borderRadius={999}
          paddingHorizontal={12}
          paddingVertical={6}
          pressStyle={{ opacity: 0.85 }}
          onPress={() => setCreateVisible(true)}
        >
          <XStack ai="center" gap={4}>
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <TText color={colors.onPrimary} fontSize={14} fontWeight="600">
              新建
            </TText>
          </XStack>
        </TButton>
      </View>

      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="alarm-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>暂无定时任务</Text>
            <Text style={styles.emptyHint}>点击右上角"新建"创建任务</Text>
          </View>
        }
      />

      {/* 新建任务 */}
      <Modal
        visible={createVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateVisible(false)}
      >
        <SafeAreaView style={styles.modal} edges={["top"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>新建定时任务</Text>
            <TouchableOpacity
              onPress={() => setCreateVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.formLabel}>Cron 表达式</Text>
            <TInput
              size="$4"
              value={cronInput}
              onChangeText={setCronInput}
              placeholder="如 0 9 * * *（每天 9 点）"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              borderWidth={1}
              borderColor={colors.border}
              backgroundColor="#FFFFFF"
              focusStyle={{ borderColor: colors.primary }}
            />
            <Text style={styles.formHint}>
              格式：分 时 日 月 周。示例：0 9 * * *、*/30 * * * *
            </Text>

            <Text style={styles.formLabel}>任务内容</Text>
            <TTextArea
              size="$4"
              value={promptInput}
              onChangeText={setPromptInput}
              placeholder="让 Agent 生成什么内容？"
              placeholderTextColor={colors.textTertiary}
              minHeight={100}
              borderWidth={1}
              borderColor={colors.border}
              backgroundColor="#FFFFFF"
              focusStyle={{ borderColor: colors.primary }}
            />

            <TButton
              size="$5"
              marginTop={spacing.xl}
              borderRadius={999}
              backgroundColor={colors.primary}
              color={colors.onPrimary}
              fontWeight="600"
              disabled={!cronInput.trim() || !promptInput.trim()}
              onPress={handleCreate}
            >
              创建任务
            </TButton>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 执行历史 */}
      <Modal
        visible={historyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <SafeAreaView style={styles.modal} edges={["top"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>执行历史</Text>
            <TouchableOpacity
              onPress={() => setHistoryVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={taskRuns}
            renderItem={renderRun}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>该任务暂无执行记录</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    backgroundColor: "rgba(252,248,244,0.92)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(120,120,128,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...typography.header },
  list: { flex: 1 },
  listContent: { padding: spacing.md },
  // ---- 任务卡片 ----
  taskCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    ...shadows.card,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  taskIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  taskPrompt: { flex: 1, fontSize: 15, color: colors.textPrimary, lineHeight: 20 },
  taskStatusBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  taskStatusOn: { backgroundColor: colors.successSoft },
  taskStatusOff: { backgroundColor: colors.surface },
  taskStatusText: { fontSize: 12, fontWeight: "600" },
  taskStatusTextOn: { color: colors.success },
  taskStatusTextOff: { color: colors.textSecondary },
  taskMeta: { marginTop: spacing.sm, marginLeft: 42 },
  taskCron: {
    fontSize: 13,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  taskTime: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  taskToggle: { flexDirection: "row", alignItems: "center" },
  taskActionGroup: { flexDirection: "row", alignItems: "center" },
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
  // ---- 表单 ----
  form: { padding: spacing.lg },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  formHint: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  // ---- 执行历史 ----
  runCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    ...shadows.card,
  },
  runHeader: { flexDirection: "row", alignItems: "center" },
  runStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  runDotSuccess: { backgroundColor: colors.success },
  runDotFailed: { backgroundColor: colors.danger },
  runDotRunning: { backgroundColor: colors.primary },
  runStatus: { fontSize: 14, fontWeight: "600", flex: 1 },
  runSuccess: { color: colors.success },
  runFailed: { color: colors.danger },
  runRunning: { color: colors.primary },
  runTime: { fontSize: 12, color: colors.textTertiary },
  runOutput: { marginTop: 6, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  runError: { marginTop: 6, fontSize: 13, color: colors.danger, lineHeight: 19 },
});
