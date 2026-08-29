import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";
import { colors } from "../theme";

/** 打字指示器：三个依次跳动的小圆点，用于 Agent 正在生成时的占位。 */
export function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const dots = [dot1, dot2, dot3];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(160, dots.map((dot) => {
        const up = Animated.timing(dot, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        });
        const down = Animated.timing(dot, {
          toValue: 0,
          duration: 320,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        });
        return Animated.sequence([up, down]);
      })),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textTertiary,
    marginHorizontal: 2,
  },
});
