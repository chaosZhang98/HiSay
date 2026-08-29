import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/** 会话/消息头像：用户为主色圆形人形图标，Agent 为紫色圆形 AI 图标。 */
export function Avatar({
  role,
  size = 28,
}: {
  role: "user" | "agent";
  size?: number;
}) {
  const isUser = role === "user";
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isUser ? colors.primary : "#5E5CE6",
        },
      ]}
    >
      <Ionicons
        name={isUser ? "person" : "sparkles"}
        size={size * 0.55}
        color="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});
