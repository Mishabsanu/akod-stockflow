import { UserEditPage } from "@/components/users/UserPages";

export const metadata = { title: "Edit User" };

export default function Page({ params }: PageProps<"/dashboard/settings/users/[id]/edit">) {
  return <UserEditPage params={params} />;
}
