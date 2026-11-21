# Glossary
Domain terms, so agents don't guess their meaning. The full glossary is in `docs/PRD.md` section 1.4; these are the ones that cause mistakes.

| Term | Meaning |
|---|---|
| Companion | The character who accompanies the user. Never "Character" in the interface. |
| Goal | What the user wants to get done. Never "Mission" or "Task" for the user's work. |
| Step | One part of a Goal, with a title, a one or two sentence description and minutes. |
| Card | One short first-person text from the Companion on the focus page. Story cards are made ahead once per story part, published and shared by all users, and read by a person afterwards; they are never written live for one user (SHARED-STORY, PUBLISH-FIRST). |
| Part | One of the Companion's tasks in a story; a story has 2 to 5 parts. The app spreads the parts across the user's Steps with plain code (STORY-PARTS, CARDS-PER-PART). |
| Live parts | The only text generated live: the pause message, the rest conversation, the return pop-up and the goal split. If they fail, the app shows its failure message with Retry, never stored text (NO-BACKUP, FAIL-SCREEN). |
| Period | A named group of stories on the Life Path, like a chapter of a book. Users never see dates or ages (PERIODS). |
| Background card | The first card of a Goal, told in the Companion's own voice: who is here, where, what each knows. |
| Fate link | The story advances only when the user finishes a Step. |
| Return pop-up | The pop-up in which the Companion says what he did meanwhile, shown before the clock restarts. |
| Key slice | A turning point in a story; its key moments are must-use facts when the cards are made. It does not have to end a Step (LEAK-BY-PART). |
