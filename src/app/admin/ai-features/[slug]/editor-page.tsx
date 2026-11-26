import { notFound } from "next/navigation";
import { connection } from "next/server";
import { featureName } from "@/lib/ai-features/admin";
import { lastSave } from "@/lib/ai-features/edit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, PageHead } from "../../admin-ui";
import { readFeature, readPeople } from "../load";
import { SectionsEditor, type EditorSection } from "../sections-editor";

// #453 (part of #430 T6; AI-PAGE-EDIT): the two editors of one AI feature, for admins and writers
// (the admin layout's role check). "purpose": (a) purpose and (c) current approach, drawing AIF-7;
// "pass": (b) the pass standard, drawing AIF-6. The schema keeps (a) to (c) as lists of lines with
// a source and a draft flag and no versions, so the drawing's Versions panel is the last save here,
// and its Save draft and Publish are one Save.

const KINDS = {
  purpose: {
    suffix: "purpose and approach",
    lede: "Two short texts. Saving marks every line on this page as checked: its “Draft - owner to edit” label goes and its source stays. Clear a box to remove its line.",
  },
  pass: {
    suffix: "pass standard",
    lede: "Loose yes or no questions. Saving marks every question as checked: its “Draft - owner to edit” label goes and its source stays.",
  },
} as const;

export async function FeatureEditorPage({
  slug,
  kind,
}: {
  slug: string;
  kind: keyof typeof KINDS;
}) {
  await connection();
  const client = await createSupabaseServerClient();
  const [feature, people] = await Promise.all([
    readFeature(client, slug),
    readPeople(client, slug),
  ]);
  if (feature === undefined) notFound();
  const crumbs = [
    { label: "AI rules" },
    { label: "AI features", href: "/admin/ai-features" },
    { label: feature ? featureName(feature.title) : slug, href: `/admin/ai-features/${slug}` },
  ];
  const title = `${feature?.title ?? slug} · ${KINDS[kind].suffix}`;
  if (!feature) {
    return (
      <>
        <Breadcrumb items={crumbs} />
        <PageHead title={title} />
        <p className="admin-notice" role="alert">
          This AI feature could not be read. Try again later.
        </p>
      </>
    );
  }
  const sections: EditorSection[] =
    kind === "pass"
      ? [
          {
            name: "pass_questions",
            label: "(b) Pass standard",
            line: "Question",
            add: "Add question",
            items: feature.pass_questions,
          },
        ]
      : [
          {
            name: "purpose",
            label: "(a) Purpose: what the feature does for the user, one or two sentences",
            line: "Purpose",
            add: "Add a purpose line",
            items: feature.purpose,
          },
          {
            name: "approach",
            label: "(c) Current approach: prompts used, number of calls, checks",
            line: "Approach",
            add: "Add an approach line",
            items: feature.approach,
          },
        ];

  return (
    <>
      <Breadcrumb items={crumbs} />
      <SectionsEditor
        kind={kind}
        lastSave={lastSave(feature, people)}
        lede={KINDS[kind].lede}
        loadedAt={feature.sections_updated_at ?? null}
        sections={sections}
        slug={slug}
        title={title}
      />
    </>
  );
}
