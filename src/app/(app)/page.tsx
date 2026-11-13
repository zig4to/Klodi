import Link from "next/link";
import SsoBridge from "@/components/auth/SsoBridge";
import NoAccess from "@/components/NoAccess";
import { IconPlus } from "@/components/ui/icons";
import { hasAccess } from "@/lib/cloud";
import { createClient } from "@/lib/supabase/server";
import { repoTitle, iconSvg, repoStyle } from "@/lib/suite";

export const dynamic = "force-dynamic";

// Domov: kartice omogočenih repozitorijev (kot pogled Claude Live v DevHost).
export default async function Home() {
  const { access } = await hasAccess();
  if (!access) return <NoAccess />;
  const supabase = await createClient();
  const { data: repos } = await supabase.from("cloud_repos").select("*").order("full_name");

  return (
    <div>
      <SsoBridge />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Repozitoriji</h1>
        <Link
          href="/nastavitve#repozitoriji"
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <IconPlus /> Dodaj
        </Link>
      </div>

      {!repos?.length ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Še nimaš povezanega repozitorija.{" "}
          <Link href="/nastavitve" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Poveži GitHub in Claude
          </Link>
          , nato tukaj izberi repozitorij in Claudu povej, kaj naj spremeni.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {repos.map((r) => {
            const ready = !!r.workflow_installed_at && !!r.secret_name;
            return (
              <Link
                key={r.id}
                href={`/r/${r.id}`}
                className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                style={{ ["--a" as string]: repoStyle(r).accent, ["--b" as string]: repoStyle(r).accent2 }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, var(--a), var(--b))" }}
                >
                  <span className="h-5 w-5 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: iconSvg(repoStyle(r).icon) }} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{repoTitle(r.full_name)}</span>
                  <span className="block truncate font-mono text-xs text-gray-500 dark:text-gray-400">{r.full_name}</span>
                </span>
                {!ready && (
                  <span className="self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {r.workflow_installed_at ? "Manjka secret" : "Ni workflowa"}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
