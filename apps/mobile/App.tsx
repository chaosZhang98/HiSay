import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { TamaguiProvider } from "tamagui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  MathJaxRenderer as MathJaxRendererImpl,
  MathRenderer,
} from "react-native-latex-text";
import ChatScreen from "./src/screens/ChatScreen";
import TaskScreen from "./src/screens/TaskScreen";
import { tamaguiConfig } from "./src/tamagui.config";

// 该库打包的是 @types/react@18 类型，与项目 @types/react@19 不兼容，运行时无影响
type MathJaxRendererRef = { reload?: () => void };
interface MathJaxRendererProps {
  ref?: React.Ref<MathJaxRendererRef>;
  maxCacheSize?: number;
  initialCache?: string[];
  onReady?: () => void;
}
const MathJaxRenderer = MathJaxRendererImpl as unknown as (
  props: MathJaxRendererProps
) => React.ReactNode;

export default function App() {
  const [tab, setTab] = useState<"chat" | "tasks">("chat");

  // 初始化 LaTeX 公式渲染器（隐藏 WebView + SVG，供 AgentMarkdown 中的 MathText 使用）
  const mathJaxRef = useRef<MathJaxRendererRef>(null);
  useEffect(() => {
    MathRenderer.Init(mathJaxRef as never);
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SafeAreaProvider>
        {tab === "chat" ? (
          <ChatScreen onOpenTasks={() => setTab("tasks")} />
        ) : (
          <TaskScreen onBack={() => setTab("chat")} />
        )}
        <MathJaxRenderer ref={mathJaxRef} maxCacheSize={80} />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </TamaguiProvider>
  );
}
