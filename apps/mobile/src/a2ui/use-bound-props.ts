import { useEffect, useState } from "react";
import {
  ComponentContext,
  GenericBinder,
  type SurfaceModel,
} from "@a2ui/web_core/v0_9";

export function useBoundProps(
  surface: SurfaceModel,
  componentId: string,
  basePath = "/",
): Record<string, unknown> {
  const [props, setProps] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const model = surface.componentsModel.get(componentId);
    const api = model ? surface.catalog.components.get(model.type) : undefined;
    if (!model || !api) {
      setProps({});
      return;
    }

    const context = new ComponentContext(surface, componentId, basePath);
    const binder = new GenericBinder<Record<string, unknown>>(context, api.schema);
    setProps({ ...binder.snapshot });
    const subscription = binder.subscribe((next: Record<string, unknown>) => {
      setProps({ ...next });
    });
    return () => subscription.unsubscribe();
  }, [surface, componentId, basePath]);

  return props;
}
