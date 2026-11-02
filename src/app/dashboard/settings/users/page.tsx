import { UserListPage } from "@/components/users/UserPages";

export const metadata = { title: "Users" };

export default function Page({ searchParams }: PageProps<"/dashboard/settings/users">) {
  return <UserListPage searchParams={searchParams} />;
}
