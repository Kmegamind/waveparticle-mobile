import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { storyDetail } from "@/lib/story-cards/admin";
import { leaksForStory } from "@/lib/story-cards/checks";
import {
  COMPANION_ID,
  readStageZeros,
  readStoryCardsData,
  readWaitingStageZeros,
  sceneCheckFor,
} from "@/lib/story-cards/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PublishFirstNotice } from "../publish-first-notice";
import { StoryCardsEditor } from "./story-cards-editor";
import { Breadcrumb, PageHead } from "@/app/admin/admin-ui";

export const instant = false;

const STORY_ID = /^[a-z0-9][a-z0-9-]*$/;

// ADM-06, one story (#293, #304), laid out as the prototype's Story cards screen (#444): its
// background card, then its cards grouped by part with the part title, beside a phone preview. An admin or writer edits a card (a new draft) and the part titles; every version is
// checked (length, dates, spoilers by part, banned words) and only the admin role publishes a
// passing draft. Any Companion's story (#502). An unknown story shows the normal not-found page; the admin layout has already
// started streaming, so the status stays 200.
export default async function AdminStory({ params }: PageProps<"/admin/stories/[id]">) {
  await connection();
  const { id } = await params;
  if (!STORY_ID.test(id)) notFound();
  const client = await createSupabaseServerClient();
  const [data, zeros, role] = await Promise.all([
    readStoryCardsData(client, id),
    readStageZeros(),
    readContentRole(client),
  ]);
  const story = data.stories.find((row) => row.id === id);
  if (data.ok && !story) notFound();
  const leaks = leaksForStory(data.cards, zeros?.get(id) ?? null);
  // #526: a story whose new stage 0 waits for its switch-over also shows, as warnings, what that
  // stage 0 finds. Publish is checked against the live stage 0 only (phones read that one).
  const after = await readWaitingStageZeros(zeros);
  const afterSwitch =
    after.zeros && after.waiting.has(id)
      ? {
          leaksFor: leaksForStory(data.cards, after.zeros.get(id) ?? null),
          scene: sceneCheckFor(after.zeros, id),
        }
      : undefined;
  const detail = story
    ? storyDetail(
        story,
        data.parts,
        data.cards,
        leaks,
        sceneCheckFor(zeros, id),
        data.companion?.key_code,
        afterSwitch,
      )
    : null;
  // #502: the Stories list of this story's Companion; Oppenheimer's keeps its plain address.
  const companionId = story?.companion_id ?? COMPANION_ID;
  const listHref =
    companionId === COMPANION_ID ? "/admin/stories" : `/admin/stories?companion=${companionId}`;
  const drafts =
    data.cards.length > 0 && data.cards.every((card) => !card.published && !card.published_at);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Stories", href: listHref },
          { label: detail ? `Story ${detail.sequence} · ${detail.title}` : "Story" },
        ]}
      />
      <PageHead
        lede={
          <>
            Saving a card makes a new draft; phones keep the published version. Every save checks
            the length (the background card: at most 70 words; a part card over 4 sentences or 60
            words only gets a warning), years, dates and ages, words from later parts, people who
            are not in the scene table and banned words, and reads the card in its story with the
            other published cards: it may not repeat an earlier card, open with the same three words
            as one of the four cards before it, or come close to an earlier card, and no later card
            may repeat it. An admin publishes a draft that passes every check.
          </>
        }
        title="Story cards"
      />
      <PublishFirstNotice drafts={drafts} />
      {zeros === null ? (
        <p className="admin-notice" role="alert">
          The story inputs could not be read, so the spoiler check cannot run. Nothing can be
          published until it can.
        </p>
      ) : null}
      {after.failed ? (
        <p className="admin-notice" role="status">
          The new stage 0 waiting for the switch-over could not be read, so the warnings for after
          the switch-over are not shown. Run npm run check:export-cards before switching a story.
        </p>
      ) : null}
      {!data.ok || !detail || !role ? (
        <p className="admin-notice" role="alert">
          This story or its cards could not be read. Try again later.
        </p>
      ) : (
        <StoryCardsEditor detail={detail} role={role} />
      )}
    </>
  );
}
