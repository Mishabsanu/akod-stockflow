import "server-only";
import { MR_PRIORITY_LABELS, MR_STATUS_LABELS, type MaterialRequest, type MaterialRequestItem } from "@/lib/materialRequestTypes";
import { parseListQuery } from "../http/query";
import { listMaterialRequests, MR_FILTERS } from "../services/materialRequest.service";
import type { IoEntity } from "./types";

type Row = { mr: MaterialRequest; item: MaterialRequestItem };

/** One row per requested product, same filters as the list screen. */
export const materialRequestsIo: IoEntity<Row> = {
  title: "Material Requests",
  module: "material_request",
  fileName: "Material_Requests",
  columns: [
    { header: "MR No", width: 12, value: (r) => r.mr.mrNo },
    { header: "Request Date", width: 12, value: (r) => r.mr.requestDate },
    { header: "Required By", width: 12, value: (r) => r.mr.requiredBy ?? "" },
    { header: "Priority", width: 10, value: (r) => MR_PRIORITY_LABELS[r.item.priority ?? "MEDIUM"] },
    { header: "Requested By", width: 20, value: (r) => r.mr.requestedByName },
    { header: "SKU Code", width: 18, value: (r) => r.item.sku },
    { header: "Product", width: 28, value: (r) => r.item.name },
    { header: "Required Qty", width: 12, value: (r) => r.item.quantity },
    { header: "Received Qty", width: 12, value: (r) => r.item.receivedQty },
    { header: "Status", width: 18, value: (r) => MR_STATUS_LABELS[r.mr.status] },
    { header: "Approved By", width: 18, value: (r) => r.mr.approvedByName ?? "" },
    { header: "Notes", width: 30, value: (r) => r.mr.notes ?? "" },
  ],
  rows: async (params) => {
    const query = { ...parseListQuery(params, MR_FILTERS), page: 1, limit: 5000 };
    const { items } = await listMaterialRequests(query);
    return items.flatMap((mr) => mr.items.map((item) => ({ mr, item })));
  },
};
