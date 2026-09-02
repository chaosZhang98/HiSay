import type { ReactNode } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { SurfaceModel } from "@a2ui/web_core/v0_9";
import { colors, radius, spacing } from "../theme";

export type ChildRef = { id: string; basePath?: string };

export type CatalogPresenter = (input: {
  id: string;
  surface: SurfaceModel;
  props: Record<string, unknown>;
  renderChild: (child: ChildRef) => ReactNode;
}) => ReactNode;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toChildRefs(children: unknown): ChildRef[] {
  if (typeof children === "string") {
    return [{ id: children }];
  }
  if (!Array.isArray(children)) return [];
  return children.flatMap((child) => {
    if (typeof child === "string") return [{ id: child }];
    if (isRecord(child) && typeof child.id === "string") {
      return [
        {
          id: child.id,
          basePath: typeof child.basePath === "string" ? child.basePath : undefined,
        },
      ];
    }
    return [];
  });
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function textVariantStyle(variant: unknown) {
  switch (variant) {
    case "h1":
      return styles.heading1;
    case "h2":
      return styles.heading2;
    case "h3":
      return styles.heading3;
    case "h4":
    case "h5":
      return styles.heading4;
    case "caption":
      return styles.caption;
    default:
      return styles.body;
  }
}

const presenters = new Map<string, CatalogPresenter>();

export function registerPresenter(type: string, render: CatalogPresenter): void {
  presenters.set(type, render);
}

export function resolvePresenter(type: string): CatalogPresenter | undefined {
  return presenters.get(type);
}

registerPresenter("Text", ({ id, props }) => (
  <Text key={id} style={[styles.body, textVariantStyle(props.variant)]}>
    {asString(props.text)}
  </Text>
));

registerPresenter("Image", ({ id, props }) => {
  const url = asString(props.url);
  if (!url) return null;
  return (
    <Image
      key={id}
      source={{ uri: url }}
      accessibilityLabel={asString(props.description) || undefined}
      style={styles.image}
      resizeMode="cover"
    />
  );
});

registerPresenter("Divider", ({ id }) => <View key={id} style={styles.divider} />);

registerPresenter("Column", ({ id, props, renderChild }) => (
  <View key={id} style={styles.column}>
    {toChildRefs(props.children).map((child) => renderChild(child))}
  </View>
));

registerPresenter("Row", ({ id, props, renderChild }) => (
  <View key={id} style={styles.row}>
    {toChildRefs(props.children).map((child) => renderChild(child))}
  </View>
));

registerPresenter("TextField", ({ id, props }) => {
  const setValue = typeof props.setValue === "function" ? props.setValue : undefined;
  return (
    <View key={id} style={styles.field}>
      {props.label ? <Text style={styles.fieldLabel}>{asString(props.label)}</Text> : null}
      <TextInput
        style={styles.input}
        value={asString(props.value)}
        placeholderTextColor={colors.textTertiary}
        onChangeText={(text) => setValue?.(text)}
      />
    </View>
  );
});

registerPresenter("ChoicePicker", ({ id, props }) => {
  const selected = asStringList(props.value);
  const setValue = typeof props.setValue === "function" ? props.setValue : undefined;
  const options = Array.isArray(props.options) ? props.options : [];
  return (
    <View key={id} style={styles.choiceWrap}>
      {props.label ? <Text style={styles.fieldLabel}>{asString(props.label)}</Text> : null}
      <View style={styles.row}>
        {options.map((raw) => {
          if (!isRecord(raw) || typeof raw.value !== "string") return null;
          const isSelected = selected.includes(raw.value);
          return (
            <Pressable
              key={raw.value}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => setValue?.([raw.value])}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={asString(raw.label)}
            >
              <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                {asString(raw.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

registerPresenter("Button", ({ id, surface, props, renderChild }) => {
  const childId = typeof props.child === "string" ? props.child : undefined;
  const variant = props.variant === "primary" ? styles.buttonPrimary : styles.buttonDefault;
  const runAction = () => {
    if (typeof props.action === "function") {
      props.action();
      return;
    }
    if (isRecord(props.action)) {
      void surface.dispatchAction(props.action, id);
    }
  };
  return (
    <Pressable
      key={id}
      style={({ pressed }) => [variant, pressed && styles.buttonPressed]}
      onPress={runAction}
      accessibilityRole="button"
    >
      {childId ? renderChild({ id: childId }) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  column: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  heading1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  heading2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  heading3: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  heading4: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  buttonDefault: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  buttonPrimary: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  field: {
    gap: 6,
    width: "100%",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  input: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  image: {
    width: "100%",
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  choiceWrap: {
    gap: 6,
    width: "100%",
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.primaryDeep,
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
    width: "100%",
  },
});
