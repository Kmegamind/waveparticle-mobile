import { FeatureEditorPage } from "../editor-page";
import "../../ai-features.css";

export const instant = false;

// #453: (b) the pass standard of one AI feature, as drawing AIF-6.
export default async function AdminAiFeaturePass({
  params,
}: PageProps<"/admin/ai-features/[slug]/pass">) {
  const { slug } = await params;
  return <FeatureEditorPage kind="pass" slug={slug} />;
}
