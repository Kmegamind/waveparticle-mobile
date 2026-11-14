# Account and privacy pages (#103, #102, #104, #8 AC3)

**Intent.** Before the app opens to everyone, a user can read in plain words what is stored and what goes to the language model, read what the stories are and what the app is not, take a copy of their data, and delete their account and everything in it. Closing issue #103; #102, #104 and #8 AC3 are covered in the same pull request.

**Facts the notice states (from the code, 2026-11-14).**
- Stored on our server (Supabase), tied to the account: profile (display name, "Keep the clock running"); Goals (title, the text written, time, status, type); Steps (title, description, minutes); sessions (story, when each Step was opened and marked done, his background card, closing line and key moments); the lines he showed (cards, pause messages, return pop-ups).
- Not stored on our server: the rest conversation (both sides) and the clocks stay on the device (decision 0014). Appearance, Plain text, Signals and the History view are on the device.
- Sent to the language model: the Goal text with the time when the Plan is split; each message written in the rest conversation. Nothing the user wrote goes into his story cards, stuck story, return pop-up or closing line (#216).
- Safety: the safety check is a word list run by our app; nothing is sent anywhere for it. The app keeps no separate record of model calls: the gateway supports a log callback, but no caller passes one (corrected after review).
- Supabase Auth and Vercel keep their own technical records (IP address, sign-in times, requests); deleting the account does not reach them (added after review).
- Provider retention is not decided (A7b); the notice says so and does not name terms it cannot confirm.
- Hosting: Supabase (sign-in and data) and Vercel (the web app).

**Goals.**
- Me shows "About the stories" and "Data" rows (prototype v4 ME).
- `/me/about`: one statement that the Companion's first-person lines are imagined; that he is an AI; that WaveParticle is not a medical or crisis service; link to the Terms. No source label anywhere else (unchanged).
- `/terms`: Terms draft, public: the character is an AI, not a medical or crisis service, the stories are imagined, deletion and export exist.
- `/privacy`: replaces the placeholder; dated; public; reachable from Me (Data) and from sign-in and sign-up (already linked).
- `/me/data`: Privacy notice, Export my data, Delete my data.
- `/me/export`: its own screen; "Download my data" gives one readable JSON file of the user's own rows from all six tables.
- `/me/delete-account`: its own screen with the prototype card (Delete your account; Keep my account; Delete account). Confirming deletes the user's rows from `session_lines`, `session_steps`, `sessions`, `steps`, `goals`, `profiles` and the auth user, signs out, and shows "Your account and your data are deleted." on sign-in.

**Non-goals.** No model calls, prompts or caps. No change to focus, rest, the goal dialogue or the Life Path. No "Data" screen beyond the three rows. No CSV.

**Anti-goals.** A legal claim we cannot back (retention, certifications, regions). Deleting another account's rows. A deleted account that can still sign in.

**Approaches (deletion).** (A, chosen by Yue) A `security definer` SQL function `public.delete_my_account()` that deletes `auth.uid()`'s rows from the six tables and then the `auth.users` row, executable only by `authenticated`. (B, rejected) A service-role key on the server: a new all-powerful secret.

**Builder's calls.** File layout, JSON shape (`{ exportedAt, account: { id, email }, profile, goals, steps, sessions, sessionSteps, sessionLines }`), copy wording within the facts above. A real Postgres test of the function needs Docker, which this machine does not have; the function is tested by text and by the e2e stub that mirrors it.
