import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  PREVIEW_NOTE,
  goalHrefFor,
  isPublicCompanion,
  playableCompanion,
} from "@/lib/content/companion-access";
import { getStoryContentForViewer } from "@/lib/content/repository";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { PERIOD_STATUS, lifePath } from "@/lib/summary/life-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { LifePathList } from "./oppenheimer/life-path-list";
import { OpenOnCurrent } from "./oppenheimer/open-on-current";

/**
 * CPAGE (#258, #50, #51): one Companion's Life Path for the signed-in account. #521: any Companion
 * with stories the account may play. A Companion who is not public (no `enterHref`) is playable
 * only by an admin or writer (the owner's preview); for anyone else his address is the normal 404,
 * as for a Companion with no stories.
 */
export async function LifePathScreen({ companionId }: { companionId: string }) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const [progress, content] = await Promise.all([
    createSupabaseProgressStore(client).read(user.id, user.id),
    getStoryContentForViewer(client),
  ]);
  const companion = playableCompanion(content, companionId);
  if (!companion) notFound();
  const view = lifePath(content, progress, undefined, companion.id);

  return (
    <main className="app-screen life-path">
      <div className="life-top">
        <Link aria-label="Back to Companions" className="life-back" href="/companions">
          <span aria-hidden="true">‹</span>
          <span className="focus-label">Companions</span>
        </Link>
        <header className="life-header">
          <Image
            alt={companion.shortName}
            className="life-portrait"
            height={96}
            src={companion.portrait}
            width={96}
          />
          <div>
            <h1>{companion.shortName}</h1>
            <p className="life-tags">{companion.tags}</p>
          </div>
        </header>
      </div>
      {isPublicCompanion(companion) ? null : <p className="try-caption">{PREVIEW_NOTE}</p>}
      <p className="try-caption">Period names are a {PERIOD_STATUS}.</p>
      <LifePathList beginHref={goalHrefFor(companion.id)} view={view} />
      <OpenOnCurrent />
    </main>
  );
}
