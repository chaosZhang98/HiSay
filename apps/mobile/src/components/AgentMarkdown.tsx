import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import Prism from "prismjs";
import { colors } from "../theme";
// 该库打包的是 @types/react@18 类型，与项目 @types/react@19 不兼容，运行时无影响
import { MathText as MathTextImpl } from "react-native-latex-text";

const MathText = MathTextImpl as unknown as React.FC<{
  content: string;
  textColor?: string;
  fontSize?: number;
}>;

// 按需注册常用语言（prism core 自带 markup/css/clike/javascript）
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-yaml";

/** 数学公式分隔符：$...$、$$...$$、\(...\)、\[...\] */
const MATH_RE =
  /(\$\$[\s\S]+?\$\$|\$[^\s$][^$\n]*?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/;

/** 代码 token 配色（One Dark 风格子集） */
const TOKEN_COLORS: Record<string, object> = {
  comment: { color: "#6a737d", fontStyle: "italic" },
  prolog: { color: "#6a737d", fontStyle: "italic" },
  doctype: { color: "#6a737d", fontStyle: "italic" },
  cdata: { color: "#6a737d", fontStyle: "italic" },
  keyword: { color: "#c678dd" },
  control: { color: "#c678dd" },
  directive: { color: "#c678dd" },
  important: { color: "#c678dd" },
  boolean: { color: "#d19a66" },
  number: { color: "#d19a66" },
  string: { color: "#98c379" },
  char: { color: "#98c379" },
  "attr-value": { color: "#98c379" },
  regex: { color: "#98c379" },
  variable: { color: "#e06c75" },
  tag: { color: "#e06c75" },
  deleted: { color: "#e06c75" },
  function: { color: "#61afef" },
  builtin: { color: "#61afef" },
  symbol: { color: "#61afef" },
  "class-name": { color: "#e5c07b" },
  "attr-name": { color: "#d19a66" },
  property: { color: "#e06c75" },
  operator: { color: "#7f848e" },
  entity: { color: "#7f848e" },
  url: { color: "#7f848e" },
  punctuation: { color: "#abb2bf" },
  selector: { color: "#c678dd" },
  atrule: { color: "#c678dd" },
};

interface PrismToken {
  type: string;
  content: string | PrismToken[];
}

/** 把 Prism tokenize 结果渲染为嵌套 RN Text */
function renderTokens(
  tokens: (string | PrismToken)[],
  keys = "t"
): React.ReactNode[] {
  return tokens.map((token, i) => {
    const key = `${keys}-${i}`;
    if (typeof token === "string") {
      return <Text key={key}>{token}</Text>;
    }
    const style = TOKEN_COLORS[token.type];
    const content = Array.isArray(token.content)
      ? renderTokens(token.content, key)
      : token.content;
    return (
      <Text key={key} style={style}>
        {content}
      </Text>
    );
  });
}

/** 代码块：深色背景 + 横向滚动 + Prism 高亮 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const lang = language || "";
  const grammar = Prism.languages[lang];
  let highlighted: React.ReactNode = <Text>{code}</Text>;
  if (grammar) {
    try {
      highlighted = (
        <Text>{renderTokens(Prism.tokenize(code, grammar) as (string | PrismToken)[])}</Text>
      );
    } catch {
      highlighted = <Text>{code}</Text>;
    }
  }
  return (
    <View style={codeStyles.container}>
      {lang ? <Text style={codeStyles.lang}>{lang}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={codeStyles.code}>{highlighted}</Text>
      </ScrollView>
    </View>
  );
}

/** 从 markdown AST fence/code_block 节点取出代码文本 */
function getNodeCode(node: any): string {
  const child = node.children?.[0];
  return typeof child?.content === "string" ? child.content : "";
}

/** 数学公式检测：命中则交给 MathText 渲染（含公式+普通文本混排） */
function renderText(node: any, styles: any) {
  const content: string = node.content ?? "";
  if (MATH_RE.test(content)) {
    return (
      <MathText
        key={node.key}
        content={content}
        textColor={colors.textPrimary}
        fontSize={15}
      />
    );
  }
  return (
    <Text key={node.key} style={styles.text}>
      {content}
    </Text>
  );
}

const markdownStyles = {
  body: { color: colors.textPrimary, fontSize: 15, lineHeight: 21 },
  paragraph: { marginBottom: 4 },
  heading1: { fontSize: 20, fontWeight: "700", marginBottom: 6, marginTop: 8 },
  heading2: { fontSize: 18, fontWeight: "700", marginBottom: 4, marginTop: 8 },
  heading3: { fontSize: 16, fontWeight: "600", marginBottom: 4, marginTop: 6 },
  strong: { fontWeight: "700" },
  em: { fontStyle: "italic" },
  listBullet: { paddingLeft: 12, marginBottom: 2 },
  listNumber: { paddingLeft: 12, marginBottom: 2 },
  listItem: { marginBottom: 2 },
  link: { color: colors.primaryDeep },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: 8,
    color: colors.textSecondary,
    marginVertical: 4,
  },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
  // 图片：Agent 回复中的远程图片直接渲染（库内置 FitImage，https 默认放行）
  image: {
    maxWidth: "100%",
    borderRadius: 8,
    marginVertical: 4,
  },
  // 行内代码
  code_inline: {
    backgroundColor: colors.primarySoft,
    color: colors.primaryDeep,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 14,
    fontFamily: "Menlo-Regular",
  },
} as const;

const codeStyles = StyleSheet.create({
  container: {
    backgroundColor: "#282c34",
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
  },
  lang: {
    color: "#828997",
    fontSize: 11,
    marginBottom: 4,
    fontFamily: "Menlo-Regular",
  },
  code: {
    color: "#abb2bf",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Menlo-Regular",
  },
});

const rules = {
  fence: (node: any) => (
    <CodeBlock key={node.key} code={getNodeCode(node)} language={node.sourceInfo} />
  ),
  code_block: (node: any) => <CodeBlock key={node.key} code={getNodeCode(node)} />,
  text: (node: any, _children: any, _parent: any, styles: any) =>
    renderText(node, styles),
};

/**
 * Agent 消息 Markdown 渲染器：
 * - 标准 Markdown（标题/粗斜体/列表/引用/链接/表格）
 * - 代码块 Prism 语法高亮（横向滚动）
 * - 数学公式 $...$ / $$...$$ / \(...\) / \[...\]（依赖根部 MathJaxRenderer 初始化）
 * - 图片直接渲染
 */
export default function AgentMarkdown({ children }: { children: string }) {
  return (
    <Markdown style={markdownStyles} rules={rules}>
      {children}
    </Markdown>
  );
}
