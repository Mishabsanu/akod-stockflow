import { companySettingSchema } from "@/lib/validation/setting.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { getCompanySettings, updateCompanySettings } from "@/server/services/setting.service";

/** Any signed-in user may read company details (they are printed on orders). */
export const GET = apiHandler("authenticated", async () => getCompanySettings());

export const PUT = apiHandler({ module: "setting", action: "update" }, async ({ req }) =>
  updateCompanySettings(await readBody(req, companySettingSchema))
);
