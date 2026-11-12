import { pushJson, pushPreflight } from "@/app/api/push/http";
import { vapidPublicKey } from "@/lib/vapid";

export const dynamic = "force-dynamic";

/** Public VAPID key only. The private key never leaves the server. */
export function GET(request: Request) {
  return pushJson(request, { publicKey: vapidPublicKey() });
}

export function OPTIONS(request: Request) {
  return pushPreflight(request);
}
