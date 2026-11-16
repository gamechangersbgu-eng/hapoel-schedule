"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { markMaintenanceDone, reopenMaintenanceTask } from "@/services/notifications/maintenance";

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
