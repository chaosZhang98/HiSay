import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { triggerHaptic } from "../lib/haptic";
import { colors } from "../theme";

export interface PullDownMenuHandle {
  open: () => void;
  close: () => void;
  playPeek: () => void;
}

interface PullDownMenuProps {
  /**
   * @deprecated 面板标题已由 menuContent 自带，保留以免旧调用侧 typecheck 失败。
   */
  title?: string;
  menuContent: React.ReactNode;
  /** @deprecated 小程序改为只从顶部拖动手柄拉开，不再根据列表是否在顶判断。 */
  atTopRef?: React.MutableRefObject<boolean>;
  /** @deprecated 已改为固定手柄，不再使用顶栏热区。 */
  requireTopEdgeRef?: React.MutableRefObject<boolean>;
  onScrollDisabled?: (disabled: boolean) => void;
  panelHeight?: number;
  children: React.ReactNode;
}

const DEFAULT_PANEL_HEIGHT = 330;
const HANDLE_HIT_WIDTH = 88;
const HANDLE_HIT_HEIGHT = 28;

/**
 * 小程序面板：常态完全藏在屏外。
 * 只有拖动状态栏下方的固定手柄才会跟手拉出，避免和 iOS 控制中心/通知中心抢顶缘手势，
 * 也不和聊天列表翻历史抢下拉。
 */
const PullDownMenu = forwardRef<PullDownMenuHandle, PullDownMenuProps>(
  (
    {
      title: _title,
      menuContent,
      onScrollDisabled,
      panelHeight = DEFAULT_PANEL_HEIGHT,
      children,
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const progress = useRef(new Animated.Value(0)).current;
    const progressValue = useRef(0);
    const openRef = useRef(false);
    const peekTimerRef = useRef<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const panelHeightRef = useRef(panelHeight);
    panelHeightRef.current = panelHeight;

    const totalPanelHeight = panelHeight + insets.top;

    const animate = (open: boolean) => {
      openRef.current = open;
      setIsOpen(open);
      onScrollDisabled?.(open);
      if (open) triggerHaptic("light");
      Animated.spring(progress, {
        toValue: open ? 1 : 0,
        useNativeDriver: Platform.OS !== "web",
        friction: 8,
        tension: 72,
      }).start();
    };

    useImperativeHandle(ref, () => ({
      open: () => animate(true),
      close: () => animate(false),
      playPeek: () => {
        if (peekTimerRef.current != null) return;
        if (openRef.current) return;
        Animated.spring(progress, {
          toValue: 0.4,
          useNativeDriver: Platform.OS !== "web",
          friction: 9,
          tension: 80,
        }).start(({ finished }) => {
          if (!finished) return;
          peekTimerRef.current = window.setTimeout(() => {
            peekTimerRef.current = null;
            Animated.spring(progress, {
              toValue: 0,
              useNativeDriver: Platform.OS !== "web",
              friction: 8,
              tension: 70,
            }).start();
          }, 320);
        });
      },
    }));

    useEffect(() => {
      return () => {
        if (peekTimerRef.current != null) {
          window.clearTimeout(peekTimerRef.current);
          peekTimerRef.current = null;
        }
      };
    }, []);

    const applyDrag = (dy: number) => {
      const H = panelHeightRef.current;
      const ratio = openRef.current ? 1 + dy / H : dy / H;
      const clamped = Math.max(0, Math.min(1, ratio));
      progressValue.current = clamped;
      progress.setValue(clamped);
    };

    const releaseDrag = () => {
      const threshold = panelHeightRef.current > 600 ? 0.3 : 0.5;
      animate(progressValue.current > threshold);
    };

    /** 仅手柄可拉开；展开后手柄手势也可上滑收起 */
    const handlePan = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
          onPanResponderGrant: () => {
            triggerHaptic("light");
          },
          onPanResponderMove: (_e, g) => {
            applyDrag(g.dy);
          },
          onPanResponderRelease: releaseDrag,
          onPanResponderTerminate: () => animate(openRef.current),
        }),
      [progress]
    );

    /** 面板展开后，在面板上上滑收起（不绑在整页，避免和列表冲突） */
    const panelClosePan = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_e, g) =>
            openRef.current && g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
          onPanResponderMove: (_e, g) => {
            applyDrag(g.dy);
          },
          onPanResponderRelease: releaseDrag,
          onPanResponderTerminate: () => animate(openRef.current),
        }),
      [progress]
    );

    const panelTranslateY = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-totalPanelHeight, 0],
    });
    const isFullHeight = panelHeight > 600;
    const overlayOpacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.35],
    });
    const overlayPointerEvents = isOpen
      ? "auto"
      : progressValue.current > 0
        ? "auto"
        : "none";
    const showHandle = true;

    return (
      <View style={styles.container}>
        <View style={styles.content}>{children}</View>

        <Animated.View
          pointerEvents={overlayPointerEvents as "auto" | "none"}
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => animate(false)}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          {...panelClosePan.panHandlers}
          pointerEvents={
            isOpen || progressValue.current > 0 ? "auto" : "none"
          }
          style={[
            styles.panel,
            {
              top: 0,
              height: totalPanelHeight,
              paddingTop: insets.top,
              transform: [{ translateY: panelTranslateY }],
              borderBottomLeftRadius: isFullHeight ? 0 : 20,
              borderBottomRightRadius: isFullHeight ? 0 : 20,
            },
          ]}
        >
          {menuContent}
        </Animated.View>

        {showHandle ? (
          <View
            pointerEvents="box-none"
            style={[styles.handleDock, { top: insets.top + 4 }]}
          >
            <View
              style={styles.handleHit}
              {...handlePan.panHandlers}
              accessibilityRole="adjustable"
              accessibilityLabel="下拉打开小程序"
            >
              <View style={styles.handlePill} />
            </View>
          </View>
        ) : null}
      </View>
    );
  }
);

PullDownMenu.displayName = "PullDownMenu";
export default PullDownMenu;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    position: "relative",
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 2,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.home.bg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 3,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  handleDock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 4,
  },
  handleHit: {
    width: HANDLE_HIT_WIDTH,
    height: HANDLE_HIT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  handlePill: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textTertiary,
    opacity: 0.45,
  },
});
