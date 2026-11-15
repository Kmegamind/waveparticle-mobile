import { connection } from "next/server";
import { Suspense } from "react";
import { AppTextProvider } from "@/lib/app-text/provider";
import { getAppTexts } from "@/lib/app-text/repository";
import { StepSafetyGate } from "./step-safety-gate";

export default function SafetyPage() {
  return (
    <Suspense fallback={null}>
      <SafetyContent />
    </Suspense>
  );
}

// The safety page's words are app text (#288), read on each request.
async function SafetyContent() {
  await connection();
  return (
    <AppTextProvider texts={await getAppTexts()}>
      <StepSafetyGate />
    </AppTextProvider>
  );
}
