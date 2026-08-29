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

export interface PullDownMenuHandle {
  open: () => void;
  close: () => void;
  /**
   * 保留接口但默认不主动执行——用户明确：常态完全隐藏，没有半开"暗示态"。
   * 如需一次性引导可在 UI 层自行显式调用（调用后由调用方负责持久化"已展示"状态）。
   */
  playPeek: () => void;
}

interface PullDownMenuProps {
  /**
   * 已弃用视觉上的面板标题：menuContent（如 MiniAppCenter）自己携带沉浸式标题与结构。
   * 保留 prop 以便旧调用侧不改，但不渲染（避免破坏 typecheck）。
   * @deprecated
   */
  title?: string;
  /** 面板内的完整菜单内容（列表/搜索/沉浸式头等）——下拉露出即等于这个组件本身 */
  menuContent: React.ReactNode;
  /** 页面内容是否已滚动到顶部（由外部维护的 ref，实时读取） */
  atTopRef: React.MutableRefObject<boolean>;
  /** 面板展开/收起时通知外部禁用/恢复页面滚动 */
  onScrollDisabled?: (disabled: boolean) => void;
  /** 面板完整展开时的高度（常态 translateY = -height 完全隐藏） */
  panelHeight?: number;
  children: React.ReactNode;
}

const DEFAULT_PANEL_HEIGHT = 330;

/**
 * 顶部下拉菜单面板（v2 对齐用户语义：常态完全隐藏）
 * =======================================================
 * 语义（与用户反馈「参考图其实是中间态」完全匹配）：
 *  1) 常态 = 面板完全在屏幕上方不可见（translateY = -panelHeight），
 *     界面上没有任何 handle/grabber/标题 等"常留提示条"，避免"半开常驻"错觉。
 *  2) 过渡 = 用户手指从顶部下拉（dy>0 且页面在 atTop），面板跟随手指向下移动，
 *     移动距离 = dy；此时就是用户上传截图的那种"中间态"。
 *  3) 松手判定 = 面板露出 > 50%（progress > 0.5）→ spring 完整展开到 0（完全可见）；
 *     否则 spring 回弹到 -panelHeight（完全隐藏）。
 *  4) 展开后 = 面板 overlay 半透明黑罩；点罩 / 面板内上滑 / 外部调用 close()
 *     → 回到 -panelHeight 完全隐藏。
 *
 * 视觉：menuContent（如 MiniAppCenter）自身就是完整面板，容器不再额外叠
 *      panelHeader/handle/标题，保证下拉露出的视觉 = 参考图 1:1。
 */
const PullDownMenu = forwardRef<PullDownMenuHandle, PullDownMenuProps>(
  (
    {
      // title: 已废弃，保留形参避免旧调用侧 typecheck 失败
      title: _title,
      menuContent,
      atTopRef,
      onScrollDisabled,
      panelHeight = DEFAULT_PANEL_HEIGHT,
      children,
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    // progress ∈ [0, 1]: 0 = 完全隐藏，1 = 完全展开
    const progress = useRef(new Animated.Value(0)).current;
    const progressValue = useRef(0);
    const openRef = useRef(false);
    const peekTimerRef = useRef<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const panelHeightRef = useRef(panelHeight);
    const topInsetRef = useRef(insets.top);
    panelHeightRef.current = panelHeight;
    topInsetRef.current = insets.top;

    // 面板总高 = 业务高度 + 顶部安全区（安全区内放 grabber/title 等状态栏下方内容）
    // 隐藏时整体向上平移的像素 = 总高，保证 100% 在屏幕上沿以外（完全不可见）
    const totalPanelHeight = panelHeight + insets.top;

    const animate = (open: boolean) => {
      openRef.current = open;
      setIsOpen(open);
      onScrollDisabled?.(open);
      if (open) triggerHaptic("light");
      // Web 端 useNativeDriver=true 会在首帧出现 Animated.Value(0) 尚未计算
      // 时面板先在 translateY=0 出现造成闪烁，这里用 JS driver 保证首帧就正确。
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
        // 一次性引导（保留接口但需要外部主动调用）：
        // 短暂露出到 40% → 320ms 收回。UI 层自己决定是否 + 何时持久化已展示。
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

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_evt, g) => {
            const { dy, dx } = g;
            // 已展开时：只接受上滑（dy<0 且主要纵向）作为收起
            if (openRef.current) {
              return dy < -8 && Math.abs(dy) > Math.abs(dx);
            }
            // 未展开时：仅当页面在顶部（atTopRef.current=true）且
            // 用户下拉（dy>8）且主要是纵向运动，才接管手势
            if (!atTopRef.current) return false;
            return dy > 8 && Math.abs(dy) > Math.abs(dx);
          },
          onPanResponderMove: (_evt, g) => {
            const H = panelHeightRef.current;
            // progress 归一化到"业务区高度 H"，而不是总高（总高 = H + topInset）：
            // 未展开：dy=0→progress=0（translateY=-(H+topInset) 完全藏），dy=H→progress=1（translateY=0 完全露）
            // 已展开：1 + dy/H；dy<0 负值收
            const ratio = openRef.current ? 1 + g.dy / H : g.dy / H;
            const clamped = Math.max(0, Math.min(1, ratio));
            progressValue.current = clamped;
            progress.setValue(clamped);
          },
          onPanResponderRelease: () => {
            // 阈值：普通高度露出过半即展开；整屏高度面板改为 0.3，避免拖动距离过长
            const threshold = panelHeightRef.current > 600 ? 0.3 : 0.5;
            animate(progressValue.current > threshold);
          },
          onPanResponderTerminate: () => {
            // 外部中断（如来电/系统手势）：保持当前开合态
            animate(openRef.current);
          },
        }),
      [progress, atTopRef]
    );

    // 面板 translateY：
    //   progress=0 → -(H + topInset) = -(panelHeight + insets.top) → 完全藏在屏上沿外，像素 1 也不露
    //   progress=1 → 0 → 顶部与屏上沿齐平，完整露出
    const panelTranslateY = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-totalPanelHeight, 0],
    });
    // 整屏高度面板直达屏幕底部，不再做悬浮卡片式的底部圆角
    const isFullHeight = panelHeight > 600;
    // overlay 透明度：0 → 0.35 随 progress 同步
    const overlayOpacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.35],
    });
    // 手指正在中间移动时，overlay 也要能命中点击（不仅仅 isOpen），
    // 所以 pointerEvents = progress>0 才 box-none。通过 isOpen 或"有进度"判断。
    const overlayPointerEvents = isOpen ? "auto" : progressValue.current > 0 ? "auto" : "none";

    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* 底层：children 页面内容（主页/聊天），始终不移动 */}
        <View style={styles.content}>{children}</View>

        {/* 遮罩：面板下移露出后同步淡入，点击遮罩 = 收起 */}
        <Animated.View
          pointerEvents={overlayPointerEvents as any}
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => animate(false)}
            activeOpacity={1}
          />
        </Animated.View>

        {/* 顶层：菜单面板。常态 translateY=-totalPanelHeight 藏在屏上沿（含 insets 不留缝）；下拉跟随 dy；松手阈值回弹 */}
        <Animated.View
          pointerEvents={isOpen ? "auto" : progressValue.current > 0 ? "auto" : "none"}
          style={[
            styles.panel,
            {
              top: 0,
              height: totalPanelHeight,
              paddingTop: insets.top,
              transform: [{ translateY: panelTranslateY }],
              // 整屏面板：底部与屏幕齐平，去掉悬浮卡片圆角与阴影
              borderBottomLeftRadius: isFullHeight ? 0 : 20,
              borderBottomRightRadius: isFullHeight ? 0 : 20,
            },
          ]}
        >
          {/*
            注意：PullDownMenu 容器自己不渲染任何壳（handle/标题/关闭按钮都不要）。
            这是用户明确反馈「常态完全隐藏 + 没有半开常留中间态」的关键：
            一旦面板露出 = menuContent 自己就是 100% 完整的视觉载体。
          */}
          {menuContent}
        </Animated.View>
      </View>
    );
  }
);

PullDownMenu.displayName = "PullDownMenu";
export default PullDownMenu;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 主页 home 是 #0A0A0A，聊天是浅色——由 children 自己负责。
    // PullDownMenu 容器本身透明，避免覆盖主题色。
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
    // height/top/paddingTop 在外层 inline 计算（因为依赖 insets + 传参 panelHeight）
    backgroundColor: "transparent", // menuContent 自己是浅色背景（如 colors.background）
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
});
