import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { getStoryContent } from "@/lib/content/repository";
import { PERIOD_STATUS, lifePath } from "@/lib/summary/life-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { LifePathList } from "./life-path-list";
import { OpenOnCurrent } from "./open-on-current";

export const instant = false;

/** CPAGE (#258, #50, #51): Oppenheimer's Life Path for the signed-in account. */
export default function OppenheimerLifePath() {
  return <LifePathContent />;
}

async function LifePathContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const progress = await createSupabaseProgressStore(client).read(user.id, user.id);
  const view = lifePath(await getStoryContent(), progress);

  return (
    <main className="app-screen life-path">
      <div className="life-top">
        <Link aria-label="Back to Companions" className="life-back" href="/companions">
          <span aria-hidden="true">‹</span>
          <span className="focus-label">Companions</span>
        </Link>
        <header className="life-header">
          <Image
            alt="Oppenheimer"
            className="life-portrait"
            height={96}
            src="/companions/oppenheimer.png"
            width={96}
          />
          <div>
            <h1>Oppenheimer</h1>
            <p className="life-tags">Brilliant · Eloquent · Haunted</p>
          </div>
        </header>
      </div>
      <p className="try-caption">Period names are a {PERIOD_STATUS}.</p>
      <LifePathList view={view} />
      <OpenOnCurrent />
    </main>
  );
}
