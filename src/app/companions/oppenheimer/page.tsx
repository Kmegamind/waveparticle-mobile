import { LifePathScreen } from "../life-path-screen";

export const instant = false;

/** CPAGE (#258, #50, #51): Oppenheimer's Life Path for the signed-in account (his own address). */
export default function OppenheimerLifePath() {
  return <LifePathScreen companionId="oppenheimer" />;
}
