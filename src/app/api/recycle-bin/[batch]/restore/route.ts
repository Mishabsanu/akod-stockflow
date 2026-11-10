import { apiHandler } from "@/server/http/handler";
import { restoreFromBin } from "@/server/services/recycleBin.service";

/** Restore everything deleted in that action (needs delete permission on the item's module). */
export const POST = apiHandler<{ batch: string }>("authenticated", async ({ params, user }) => restoreFromBin(params.batch, user));
