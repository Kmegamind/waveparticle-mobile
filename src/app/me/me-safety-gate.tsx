"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CrisisPage } from "../safety/crisis-page";

/**
 * S1 on the Me page (#392, owner decision on gap 4): when the server's safety check flags the
 * display name, the safety page shows in place of Me, at the same address. The Me page stays
 * mounted but hidden, so Back returns to it exactly as it was: the name field still in edit mode,
 * emptied by the field itself, and the saved name unchanged (nothing was saved).
 */

/** Shows S1; `onBack` runs when "Back" is pressed, after Me is shown again. */
type ShowCrisis = (onBack: () => void) => void;

const MeSafetyContext = createContext<ShowCrisis>(() => {});

export const useShowCrisis = () => useContext(MeSafetyContext);

export function MeSafetyGate({ children }: { children: ReactNode }) {
  const [crisis, setCrisis] = useState(false);
  const back = useRef<(() => void) | null>(null);
  const returning = useRef(false);

  useEffect(() => {
    // Runs once Me is visible again, so the name field can take focus.
    if (!crisis && returning.current) {
      returning.current = false;
      back.current?.();
      back.current = null;
    }
  }, [crisis]);

  // Stable, so a component can call it from an effect without running it again.
  const show = useCallback((onBack: () => void) => {
    back.current = onBack;
    setCrisis(true);
  }, []);

  return (
    <MeSafetyContext.Provider value={show}>
      {/* Hidden, not unmounted: the typed state of Me survives S1. */}
      <div className="me-safety-gate" hidden={crisis}>
        {children}
      </div>
      {crisis ? (
        <CrisisPage
          onBack={() => {
            returning.current = true;
            setCrisis(false);
          }}
        />
      ) : null}
    </MeSafetyContext.Provider>
  );
}
