import { FeatureEditorPage } from "../editor-page";
import "../../ai-features.css";

export const instant = false;

// #453: (a) purpose and (c) current approach of one AI feature, as drawing AIF-7.
export default async function AdminAiFeaturePurpose({
  params,
}: PageProps<"/admin/ai-features/[slug]/purpose">) {
  const { slug } = await params;
  return <FeatureEditorPage kind="purpose" slug={slug} />;
}
