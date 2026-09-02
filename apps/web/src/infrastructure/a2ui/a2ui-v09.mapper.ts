import {
  A2UI_OPERATIONS_KEY,
  A2UIActivityType,
} from "@ag-ui/a2ui-middleware";
import { A2UI_V09_BASIC_CATALOG_ID } from "@hisay/shared";

export { A2UI_V09_BASIC_CATALOG_ID };

function officialDemoOperations(surfaceId: string): Record<string, unknown>[] {
  return [
    {
      version: "v0.9",
      createSurface: {
        surfaceId,
        catalogId: A2UI_V09_BASIC_CATALOG_ID,
        sendDataModel: true,
      },
    },
    {
      version: "v0.9",
      updateComponents: {
        surfaceId,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["title", "hero", "hint", "note", "meal", "rule", "actions"],
          },
          { id: "title", component: "Text", text: "A2UI 会话画布", variant: "h3" },
          {
            id: "hero",
            component: "Image",
            url: "https://picsum.photos/seed/hisaya2ui/800/360",
            description: "示例配图",
          },
          {
            id: "hint",
            component: "Text",
            text: "填一句备注、选一餐，再点确认。这是官方 Basic Catalog 积木拼出来的。",
          },
          {
            id: "note",
            component: "TextField",
            label: "备注",
            value: { path: "/note" },
          },
          {
            id: "meal",
            component: "ChoicePicker",
            variant: "mutuallyExclusive",
            displayStyle: "chips",
            options: [
              { label: "早餐", value: "breakfast" },
              { label: "午餐", value: "lunch" },
              { label: "晚餐", value: "dinner" },
            ],
            value: { path: "/meal" },
          },
          { id: "rule", component: "Divider", axis: "horizontal" },
          { id: "actions", component: "Row", children: ["submit", "cancel"] },
          {
            id: "submit",
            component: "Button",
            child: "submit_label",
            variant: "primary",
            action: {
              event: {
                name: "submit",
                context: {
                  note: { path: "/note" },
                  meal: { path: "/meal" },
                },
              },
            },
          },
          { id: "submit_label", component: "Text", text: "确认" },
          {
            id: "cancel",
            component: "Button",
            child: "cancel_label",
            action: { event: { name: "cancel" } },
          },
          { id: "cancel_label", component: "Text", text: "取消" },
        ],
      },
    },
    {
      version: "v0.9",
      updateDataModel: {
        surfaceId,
        path: "/",
        value: { note: "", meal: ["lunch"] },
      },
    },
  ];
}

export function createDemoSurfaceDocument(surfaceId: string): Record<string, unknown> {
  return {
    [A2UI_OPERATIONS_KEY]: officialDemoOperations(surfaceId),
  };
}

export function toOfficialActivityContent(
  document: Record<string, unknown>,
): Record<string, unknown> {
  if (Array.isArray(document[A2UI_OPERATIONS_KEY])) {
    return { [A2UI_OPERATIONS_KEY]: document[A2UI_OPERATIONS_KEY] };
  }

  return {
    [A2UI_OPERATIONS_KEY]: officialDemoOperations(
      typeof document.surfaceId === "string" ? document.surfaceId : "surface",
    ),
  };
}

export function officialActivityType(): string {
  return A2UIActivityType;
}
