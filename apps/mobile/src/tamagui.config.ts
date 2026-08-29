/**
 * Tamagui 配置：基于官方 v3 配置，注入项目现有设计令牌（src/theme.ts）作为语义色。
 * 让 Tamagui 组件（Button/Input/Switch 等）默认呈现与手写界面一致的视觉风格。
 */
import { createTamagui } from "tamagui";
import { config } from "@tamagui/config/v3";
import { colors } from "./theme";

// 用项目设计令牌覆盖 light 主题的语义槽位
const lightTheme = {
  ...config.themes.light,
  // 页面/卡片背景
  background: colors.background,
  backgroundHover: colors.background,
  backgroundPress: colors.background,
  backgroundFocus: colors.background,
  backgroundStrong: colors.card,
  // 文字
  color: colors.textPrimary,
  colorHover: colors.textPrimary,
  colorPress: colors.textPrimary,
  colorFocus: colors.textPrimary,
  // 描边
  borderColor: colors.border,
  borderColorHover: colors.textTertiary,
  borderColorPress: colors.textTertiary,
  // 语义色（组件 theme accent 会引用）
  blue: colors.primary,
  blue10: colors.primary,
  green: colors.success,
  green10: colors.success,
  red: colors.danger,
  red10: colors.danger,
  orange: colors.warning,
  orange10: colors.warning,
};

const themes = {
  ...config.themes,
  light: lightTheme,
  dark: {
    ...config.themes.dark,
    blue: colors.primary,
    green: colors.success,
    red: colors.danger,
    orange: colors.warning,
  },
};

export const tamaguiConfig = createTamagui({
  ...config,
  themes,
});

export type AppConfig = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}
