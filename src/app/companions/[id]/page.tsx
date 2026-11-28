import { notFound } from "next/navigation";
import { LifePathScreen } from "../life-path-screen";

export const instant = false;

const COMPANION_ID = /^[a-z][a-z0-9-]*$/;

/**
 * #521: any Companion's Life Path, /companions/<id>. A Companion who is not public is the normal
 * 404 for every account without a content role (`LifePathScreen`).
 */
export default async function CompanionLifePath({ params }: PageProps<"/companions/[id]">) {
  const { id } = await params;
  if (!COMPANION_ID.test(id)) notFound();
  return <LifePathScreen companionId={id} />;
}
