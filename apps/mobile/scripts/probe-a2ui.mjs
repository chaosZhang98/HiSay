import {
  BASIC_COMPONENTS,
  BASIC_FUNCTIONS,
  Catalog,
  MessageProcessor,
} from "@a2ui/web_core/v0_9";

const CATALOG_ID = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
const surfaceId = "probe-surface";

const operations = [
  {
    version: "v0.9",
    createSurface: {
      surfaceId,
      catalogId: CATALOG_ID,
      sendDataModel: true,
    },
  },
  {
    version: "v0.9",
    updateComponents: {
      surfaceId,
      components: [
        { id: "root", component: "Column", children: ["title", "hero", "note", "meal", "actions"] },
        { id: "title", component: "Text", text: "A2UI 会话画布" },
        {
          id: "hero",
          component: "Image",
          url: "https://picsum.photos/seed/hisaya2ui/800/360",
        },
        { id: "note", component: "TextField", label: "备注", value: { path: "/note" } },
        {
          id: "meal",
          component: "ChoicePicker",
          variant: "mutuallyExclusive",
          options: [
            { label: "早餐", value: "breakfast" },
            { label: "午餐", value: "lunch" },
            { label: "晚餐", value: "dinner" },
          ],
          value: { path: "/meal" },
        },
        { id: "actions", component: "Row", children: ["submit", "cancel"] },
        {
          id: "submit",
          component: "Button",
          child: "submit_label",
          variant: "primary",
          action: {
            event: {
              name: "submit",
              context: { note: { path: "/note" }, meal: { path: "/meal" } },
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

const catalog = new Catalog(CATALOG_ID, BASIC_COMPONENTS, BASIC_FUNCTIONS);
const processor = new MessageProcessor([catalog]);
processor.processMessages(operations);

const surface = processor.model.getSurface(surfaceId);
if (!surface) {
  throw new Error("surface missing after processMessages");
}
const root = surface.componentsModel.get("root");
if (!root) {
  throw new Error("root component missing");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      documentUndefined: typeof document === "undefined",
      catalogId: catalog.id,
      surfaceIds: [...processor.model.surfacesMap.keys()],
      rootType: root.type,
      rootChildren: root.properties.children,
      note: surface.dataModel.get("/note"),
      meal: surface.dataModel.get("/meal"),
      componentCount: [...surface.componentsModel.entries].length,
    },
    null,
    2,
  ),
);
