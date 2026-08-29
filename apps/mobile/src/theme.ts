/**
 * 设计令牌：统一 mobile 端配色、圆角、间距、阴影与字体层级。
 *
 * 配色系统按「主色调 / 辅助色 / 中性色」三个层级组织，
 * 所有色值均按 WCAG 2.1 AA 校验过对比度（关键组合 ≥4.5:1，图标级 ≥3:1）。
 *
 * - 主色调 primary：暖橙，用于按钮、焦点、品牌强调。
 *   注意：橙底上统一使用深字 onPrimary（#3A2208，6.34:1），
 *   **不要再在橙底上用白字**（白字 on 橙仅 2.35:1，不达 AA）。
 * - 辅助色 semantic：success / warning / danger / info，用于状态与反馈。
 * - 中性色 neutral：背景、卡片、边框、文字层级，均基于暖灰棕，轻盈不压抑。
 */

export const colors = {
  // =============== 主色层 · Primary ===============
  /** 品牌主橙：填充按钮、选中态、吉祥物、焦点元素 */
  primary: "#FF8A3D",
  /** 主橙按下态（略微加深，均匀反馈） */
  primaryPressed: "#F0761F",
  /** 深橙文本：在白/浅底上作为链接、强调文字（on 白 5.22:1 / on 浅底 4.71:1） */
  primaryDeep: "#B84A12",
  /** 浅橙底：作为柔和选中背景/标签底（与文字形成层级） */
  primarySoft: "#FFF1E6",
  /** 橙底上的文字色（深棕）：**所有 primary 背景上的文字/图标一律用这个，勿用白** */
  onPrimary: "#3A2208",

  // =============== 辅助色层 · Semantic ===============
  /** 成功绿：为深绿，白底 5.28:1；底用 successSoft，其上文字也用本字（4.61:1） */
  success: "#1E7B45",
  successSoft: "#E4F3EB",
  /** 警示/连接告警，白底 5.02:1 */
  warning: "#B45309",
  warningSoft: "#FFF7E0",
  /** 危险红，白底 5.44:1 */
  danger: "#C0392B",
  dangerSoft: "#FDECEA",
  /** 信息/中性提示蓝 */
  info: "#2F6FB0",
  infoSoft: "#E8F0F9",

  // =============== 中性色层 · Neutral ===============
  /** 页面背景：偏暖米白，比纯白更轻盈有呼吸感 */
  background: "#F7F3EF",
  /** 卡片 / 弹窗 / 输入框底 */
  card: "#FFFFFF",
  /** 分隔线弱化的再浅一档背景（下拉分组、次级区域） */
  surface: "#FCFAF8",
  /** 主文字，on 白 9.84:1 / on 背景 8.92:1 */
  textPrimary: "#4A423B",
  /** 次级文字，on 白 5.89:1 / on 背景 5.34:1 */
  textSecondary: "#6B635C",
  /** 三级辅助文字（时间戳/占位），on 白 5.28:1 / on 背景 4.78:1 */
  textTertiary: "#746A61",
  /** 边框 / 分割线：浅暖灰 */
  border: "#E7E0D9",
  /** 禁用态填充 / 减弱控件 */
  disabled: "#CDC5BC",
  /** 消息区 Agent 气泡底 */
  agentBubble: "#FFFFFF",
  /** 遮罩层 */
  overlay: "rgba(30,20,10,0.42)",

  // =============== 空会话主页（轻盈亮色调，替代原深黑壳） ===============
  home: {
    /** 主页背景：浅暖米，明亮轻盈 */
    bg: "#F5EFE9",
    /** 状态条 / 卡片块（浅面） */
    surface: "#FFFFFF",
    /** 胶囊 / chip 底 */
    chip: "#FFFFFF",
    chipBorder: "#EFE7DE",
    /** 图标色（深暖棕，保证可读） */
    iconTint: "#4A423B",
    /** 主标题 */
    title: "#4A423B",
    subtitle: "#6B635C",
    /** 免责 / 弱化文字 */
    tertiary: "#746A61",
    /** 吉祥物：橙系 */
    mascot: "#FF8A3D",
    mascotInner: "#FFAE72",
    mascotEye: "#3A2208",
    /** 输入胶囊 */
    input: "#FFFFFF",
    inputBorder: "#E7E0D9",
    placeholder: "#746A61",
    /** 顶栏圆点 / 焦点信号 */
    dot: "#FF8A3D",
  },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const typography = {
  header: { fontSize: 17, fontWeight: "600" as const, color: colors.textPrimary },
  body: { fontSize: 15, lineHeight: 21, color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
  small: { fontSize: 11, color: colors.textTertiary },
} as const;

export const shadows = {
  card: {
    shadowColor: "#8A7A6A",
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bubble: {
    shadowColor: "#8A7A6A",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
} as const;
