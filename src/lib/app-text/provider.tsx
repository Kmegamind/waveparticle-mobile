"use client";

import { createContext, useContext, type ReactNode } from "react";
import { APP_TEXT_DEFAULTS, type AppTextKey, type AppTexts } from "./catalog";

// Hands the published app text (#288), read on the server by getAppTexts(), to the client screens.
// Without a provider (for example on the sign-in-free test path /try) every key shows its code
// default, so a screen is never blank.

const AppTextContext = createContext<AppTexts>(APP_TEXT_DEFAULTS);

export function AppTextProvider({ texts, children }: { texts: AppTexts; children: ReactNode }) {
  return <AppTextContext.Provider value={texts}>{children}</AppTextContext.Provider>;
}

/** The text to show for a key: the published text passed in, or the code default. */
export function useAppText(key: AppTextKey): string {
  const text = useContext(AppTextContext)[key];
  return typeof text === "string" && text.trim() !== "" ? text : APP_TEXT_DEFAULTS[key];
}
