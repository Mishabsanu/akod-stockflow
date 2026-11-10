import { apiHandler } from "@/server/http/handler";
import { purgeFromBin } from "@/server/services/recycleBin.service";

/** Delete forever (needs delete permission on the item's module). */
export const DELETE = apiHandler<{ batch: string }>("authenticated", async ({ params, user }) => {
  await purgeFromBin(params.batch, user);
  return { success: true };
});
