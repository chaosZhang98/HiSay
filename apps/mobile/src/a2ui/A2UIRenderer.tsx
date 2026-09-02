import { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { SurfaceModel } from "@a2ui/web_core/v0_9";
import { colors, radius, spacing } from "../theme";
import { resolvePresenter, type ChildRef } from "./catalog";
import {
  createActivityProcessor,
  listSurfaces,
  type A2uiClientAction,
} from "./engine";
import { useBoundProps } from "./use-bound-props";

type Placement = "inline" | "fullscreen";

export function A2UIRenderer({
  content,
  placement = "inline",
  onAction,
}: {
  content: Record<string, unknown>;
  placement?: Placement;
  onAction?: (action: A2uiClientAction) => void;
}) {
  const operationsKey = JSON.stringify(content.a2ui_operations ?? null);
  const processor = useMemo(() => {
    try {
      return createActivityProcessor(content);
    } catch {
      return null;
    }
    // Recreate only when the official operation list changes, not on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationsKey]);

  useEffect(() => {
    if (!processor || !onAction) return;
    const subscription = processor.model.onAction.subscribe(onAction);
    return () => subscription.unsubscribe();
  }, [processor, onAction]);

  useEffect(() => {
    return () => processor?.model.dispose();
  }, [processor]);

  if (!processor) return null;
  const surfaces = listSurfaces(processor);
  if (surfaces.length === 0) return null;

  return (
    <View style={[styles.host, placement === "fullscreen" && styles.hostFull]}>
      {surfaces.map((surface) => (
        <SurfaceTree key={surface.id} surface={surface} />
      ))}
    </View>
  );
}

function SurfaceTree({ surface }: { surface: SurfaceModel }) {
  const root = surface.componentsModel.get("root");
  if (!root) return null;
  return (
    <View style={styles.surface}>
      <BoundNode surface={surface} componentId="root" />
    </View>
  );
}

function BoundNode({
  surface,
  componentId,
  basePath = "/",
}: {
  surface: SurfaceModel;
  componentId: string;
  basePath?: string;
}) {
  const model = surface.componentsModel.get(componentId);
  const props = useBoundProps(surface, componentId, basePath);
  if (!model) return null;

  const presenter = resolvePresenter(model.type);
  if (!presenter) return null;

  const renderChild = (child: ChildRef): ReactNode => (
    <BoundNode
      key={`${child.id}:${child.basePath ?? basePath}`}
      surface={surface}
      componentId={child.id}
      basePath={child.basePath ?? basePath}
    />
  );

  return presenter({
    id: componentId,
    surface,
    props,
    renderChild,
  });
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
  hostFull: {
    flex: 1,
  },
  surface: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
