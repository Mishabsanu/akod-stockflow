import { RoleDetailPage } from "@/components/roles/RolePages";

export const metadata = { title: "Role Details" };

export default function Page({ params }: PageProps<"/dashboard/settings/roles/[id]">) {
  return <RoleDetailPage params={params} />;
}
