import { Suspense } from "react";
import { logoutAction } from "@/actions/auth";
import NoAccess from "@/components/NoAccess";
import Setup from "@/components/setup/Setup";
import ThemeToggle from "@/components/theme/ThemeToggle";
import Button from "@/components/ui/Button";
import { IconLogout } from "@/components/ui/icons";
import { hasAccess } from "@/lib/cloud";

export const dynamic = "force-dynamic";

export default async function Nastavitve() {
  const { user, access } = await hasAccess();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Nastavitve</h1>
      {access ? (
        <Suspense>
          <Setup />
        </Suspense>
      ) : (
        <NoAccess />
      )}
      <section className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <span className="text-sm font-medium">Tema</span>
        <ThemeToggle />
      </section>
      <section className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="min-w-0">
          <div className="text-sm font-medium">Račun</div>
          <div className="truncate text-sm text-gray-500 dark:text-gray-400">{user?.email}</div>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">
            <IconLogout /> Odjava
          </Button>
        </form>
      </section>
    </div>
  );
}
