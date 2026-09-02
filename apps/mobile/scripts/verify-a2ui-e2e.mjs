import {
  BASIC_COMPONENTS,
  BASIC_FUNCTIONS,
  Catalog,
  MessageProcessor,
} from "@a2ui/web_core/v0_9";
import { A2UI_V09_BASIC_CATALOG_ID } from "@hisay/shared";
import { randomUUID } from "node:crypto";

const BASE = process.env.AGENT_URL ?? "http://127.0.0.1:8080";
const DEVICE = "ios-device-1";

function parseSse(text) {
  const events = [];
  for (const block of text.split("\n\n")) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    if (dataLines.length === 0) continue;
    try {
      events.push(JSON.parse(dataLines.join("\n")));
    } catch {
      // ignore keep-alives
    }
  }
  return events;
}

async function runAgent(body) {
  const response = await fetch(`${BASE}/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-Device-Id": DEVICE,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${await response.text()}`);
  }
  return parseSse(await response.text());
}

const threadId = randomUUID();
const first = await runAgent({
  threadId,
  runId: randomUUID(),
  messages: [{ id: randomUUID(), role: "user", content: "画一张备注卡片" }],
});

const types = first.map((event) => event.type);
const snapshot = first.find((event) => event.type === "ACTIVITY_SNAPSHOT");
if (!snapshot) {
  throw new Error(`missing ACTIVITY_SNAPSHOT, got ${types.join(",")}`);
}
if (snapshot.activityType !== "a2ui-surface") {
  throw new Error(`unexpected activityType: ${snapshot.activityType}`);
}

const operations = snapshot.content?.a2ui_operations;
if (!Array.isArray(operations) || operations.length === 0) {
  throw new Error("missing a2ui_operations");
}

const catalog = new Catalog(A2UI_V09_BASIC_CATALOG_ID, BASIC_COMPONENTS, BASIC_FUNCTIONS);
const processor = new MessageProcessor([catalog]);
processor.processMessages(operations);
const surface = [...processor.model.surfacesMap.values()][0];
if (!surface || !surface.componentsModel.get("root")) {
  throw new Error("MessageProcessor could not build root from server operations");
}

const create = operations.find((item) => item.createSurface)?.createSurface;
const second = await runAgent({
  threadId,
  runId: randomUUID(),
  messages: [{ id: randomUUID(), role: "user", content: "确认" }],
  forwardedProps: {
    a2uiAction: {
      userAction: {
        name: "submit",
        surfaceId: create?.surfaceId ?? surface.id,
        sourceComponentId: "submit",
        context: { note: "少油少盐", meal: ["lunch"] },
      },
    },
  },
});

const secondTypes = second.map((event) => event.type);
const hasText = second.some(
  (event) => event.type === "TEXT_MESSAGE_CONTENT" && typeof event.delta === "string",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      firstTypes: types,
      activityType: snapshot.activityType,
      catalogId: create?.catalogId,
      operationKeys: operations.map((item) => Object.keys(item).find((key) => key !== "version")),
      surfaceId: surface.id,
      rootType: surface.componentsModel.get("root")?.type,
      componentCount: [...surface.componentsModel.entries].length,
      meal: surface.dataModel.get("/meal"),
      secondTypes,
      secondHasText: hasText,
    },
    null,
    2,
  ),
);

if (!hasText) {
  throw new Error(`second turn had no text, types=${secondTypes.join(",")}`);
}
