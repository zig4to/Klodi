import { notFound } from "next/navigation";
import CloudChat from "@/components/chat/CloudChat";
import NoAccess from "@/components/NoAccess";
import { hasAccess } from "@/lib/cloud";
import { createClient } from "@/lib/supabase/server";
import { repoTitle } from "@/lib/suite";

export const dynamic = "force-dynamic";

export default async function RepoChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, access } = await hasAccess();
  if (!access || !user) return <NoAccess />;
  const supabase = await createClient();
  const { data: repo } = await supabase.from("cloud_repos").select("*").eq("id", id).maybeSingle();
  if (!repo) notFound();
  return <CloudChat repo={repo} title={repoTitle(repo.full_name)} userId={user.id} />;
}
