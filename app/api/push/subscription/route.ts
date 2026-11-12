import { pushJson, pushPreflight } from "@/app/api/push/http";
import { deletePushSubscription, upsertPushSubscription } from "@/lib/web-push";
import { parsePushSubscription, parseUnsubscribe } from "@/lib/push-subscription";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return pushJson(request, { error: "invalid_json" }, 400);
  }
  const parsed = parsePushSubscription(body);
  if (!parsed.ok) return pushJson(request, { error: parsed.error }, 400);
  try {
    await upsertPushSubscription(parsed.value, request.headers.get("user-agent"));
  } catch {
    console.error("[web-push] upsert failed");
    return pushJson(request, { error: "unavailable" }, 503);
  }
  return pushJson(request, { ok: true });
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return pushJson(request, { error: "invalid_json" }, 400);
  }
  const parsed = parseUnsubscribe(body);
  if (!parsed.ok) return pushJson(request, { error: parsed.error }, 400);
  try {
    await deletePushSubscription(parsed.endpoint);
  } catch {
    console.error("[web-push] delete failed");
    return pushJson(request, { error: "unavailable" }, 503);
  }
  return pushJson(request, { ok: true });
}

export function OPTIONS(request: Request) {
  return pushPreflight(request);
}
