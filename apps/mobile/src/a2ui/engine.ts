import {
  Catalog,
  MessageProcessor,
  BASIC_COMPONENTS,
  BASIC_FUNCTIONS,
  type A2uiMessage,
  type A2uiClientAction,
  type ComponentApi,
  type SurfaceModel,
} from "@a2ui/web_core/v0_9";
import { A2UI_V09_BASIC_CATALOG_ID } from "@hisay/shared";

export type { A2uiClientAction, SurfaceModel };

const basicCatalog = new Catalog(
  A2UI_V09_BASIC_CATALOG_ID,
  BASIC_COMPONENTS,
  BASIC_FUNCTIONS,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractA2uiOperations(content: Record<string, unknown>): A2uiMessage[] {
  const operations = content.a2ui_operations;
  if (!Array.isArray(operations)) return [];
  return operations.filter((item): item is A2uiMessage => isRecord(item));
}

export function createActivityProcessor(
  content: Record<string, unknown>,
): MessageProcessor<ComponentApi> | null {
  const operations = extractA2uiOperations(content);
  if (operations.length === 0) return null;
  const processor = new MessageProcessor([basicCatalog]);
  processor.processMessages(operations);
  return processor;
}

export function listSurfaces(processor: MessageProcessor<ComponentApi>): SurfaceModel[] {
  return [...processor.model.surfacesMap.values()];
}
