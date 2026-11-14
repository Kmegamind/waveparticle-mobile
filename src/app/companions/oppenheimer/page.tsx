import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PERIOD_STATUS } from "@/content/oppenheimer/periods";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { lifePath, type LifePathRow } from "@/lib/summary/life-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

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
  const view = lifePath(await createSupabaseProgressStore(client).read(user.id, user.id));
  const canBegin = isPrototypeEnabled();

  return (
    <main className="app-screen life-path">
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
      <p className="try-caption">Period names are a {PERIOD_STATUS}.</p>
      <ol className="life-periods">
        {view.periods.map((period) => (
          <li key={period.name}>
            <h2 className="focus-label life-period">{period.name}</h2>
            <ol className="life-rows">
              {period.rows.map((row) => (
                <Row canBegin={canBegin} key={row.id} row={row} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </main>
  );
}

function Row({ row, canBegin }: { row: LifePathRow; canBegin: boolean }) {
  return (
    <li className="life-row" data-state={row.state}>
      <span aria-hidden="true" className="life-node" />
      {row.state === "current" ? (
        <div className="life-current">
          <h3>{row.title}</h3>
          <p className="life-line">{row.line}</p>
          {canBegin ? (
            // The signed-in run plays this story: a new session takes the current story (#258).
            <Link className="button-filled" href="/goal">
              Begin
            </Link>
          ) : (
            <p className="try-caption">The goal dialogue is in test builds only.</p>
          )}
        </div>
      ) : (
        <div>
          <h3>
            {row.title}
            {row.state === "finished" ? <span className="sr-only"> (finished)</span> : null}
          </h3>
          {row.line ? <p className="life-line life-said">{row.line}</p> : null}
        </div>
      )}
    </li>
  );
}
