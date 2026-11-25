/**
 * How long safety log lines are kept and who may read them (US-SAF-6 AC3, #119).
 *
 * PENDING LEGAL REVIEW (#121): these are the proposal of `docs/ai/AI_05_safety.md` section 6, not
 * a decision. The lines live in the server log (Vercel Runtime Logs), which keeps them for at most
 * 30 days on any plan with no log drain (1 hour Hobby, 1 day Pro, 30 days Observability Plus), so
 * the 90-day ceiling holds today with no deletion job. A log drain, if one is ever added, must be
 * set to keep `"feature":"safety"` lines no longer than this, and to let only the named readers in.
 * The owner's step is in `docs/deploy.md`, "Safety log".
 */
export const SAFETY_LOG_RETENTION_DAYS = 90;

/** Who may read the safety log: the people listed as members of the Vercel project (named staff). */
export const SAFETY_LOG_READERS = "vercel-project-members";

/** True until the legal review (#121) confirms or changes the two values above. */
export const SAFETY_LOG_POLICY_PENDING_LEGAL = true;
