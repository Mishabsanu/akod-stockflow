import { UserDetailPage } from "@/components/users/UserPages";

export const metadata = { title: "User Details" };

export default function Page({ params }: PageProps<"/dashboard/settings/users/[id]">) {
  return <UserDetailPage params={params} />;
}
