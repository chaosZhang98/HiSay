#!/bin/bash
# sync-rules.sh - 同步规则到 .trae/rules 和 .cursor/rules
# 用法: ./sync-rules.sh

set -e

RULES_DIR="$(dirname "$0")/.rules"
TRAE_DIR="$(dirname "$0")/.trae/rules"
CURSOR_DIR="$(dirname "$0")/.cursor/rules"

echo "📋 同步规则文件..."

# 检查 .rules 目录是否存在
if [ ! -d "$RULES_DIR" ]; then
    echo "❌ .rules/ 目录不存在"
    exit 1
fi

# 同步到 .trae/rules
mkdir -p "$TRAE_DIR"
cp "$RULES_DIR"/*.md "$TRAE_DIR/" 2>/dev/null || true
cp "$RULES_DIR"/*.mdc "$TRAE_DIR/" 2>/dev/null || true
echo "✅ .trae/rules 已更新"

# 同步到 .cursor/rules
mkdir -p "$CURSOR_DIR"
cp "$RULES_DIR"/*.md "$CURSOR_DIR/" 2>/dev/null || true
cp "$RULES_DIR"/*.mdc "$CURSOR_DIR/" 2>/dev/null || true
echo "✅ .cursor/rules 已更新"

echo ""
echo "🎉 规则同步完成！"
echo "   - 修改规则请编辑 .rules/ 目录下的文件"
echo "   - 运行 ./sync-rules.sh 同步到两个工具"
