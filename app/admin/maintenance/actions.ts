"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { markMaintenanceDone, reopenMaintenanceTask, setPitchOverride } from "@/services/notifications/maintenance";

export async function markMaintenanceDoneAction(formData: FormData) {
  const user = await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) await markMaintenanceDone(id, user.displayName);
  revalidatePath("/admin", "layout");
  redirect("/admin/maintenance");
}

export async function reopenMaintenanceAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) await reopenMaintenanceTask(id);
  revalidatePath("/admin", "layout");
  redirect("/admin/maintenance");
}

/** Temporary pitch for a home game with no venue from the association (empty value = remove). */
export async function setPitchOverrideAction(formData: FormData) {
  const user = await requireAdmin();
  const slotId = Number(formData.get("slotId"));
  const raw = String(formData.get("pitchCode") ?? "");
  let error = "";
  if (Number.isInteger(slotId) && slotId > 0) {
    const result = await setPitchOverride(slotId, raw === "" ? null : raw, user.displayName);
    if (!result.ok) error = result.error;
  }
  revalidatePath("/admin", "layout");
  redirect(error ? `/admin/maintenance?error=${encodeURIComponent(error)}` : "/admin/maintenance");
}
