// #483: the admin's stylesheets. admin.css holds the frame and shared components; each page's own
// rules sit in a file next to that page, so page pull requests do not edit the same file.
//
// All of them are imported here, by the admin layout, and not by each page: the pages render
// inside the layout's Suspense boundary, and a stylesheet a page imports is loaded with the
// streamed page, which stays hidden (display: none) until that stylesheet arrives. Loaded from the
// layout, every admin stylesheet is in the first response's head, as when they were in
// globals.css. admin.css comes first; the page files only name classes of their own page, so
// their order among themselves does not matter. A new page file is added to this list.
import "./admin.css";
import "./overview.css";
import "./companions/companions.css";
import "./companions/[id]/companion-profile.css";
import "./companions/[id]/stories/[story]/companion-story.css";
import "./stories/stories.css";
import "./stories/[id]/story-cards.css";
import "./prompts/prompts.css";
import "./publish-history/publish-history.css";
import "./hotlines/hotlines.css";
import "./ai-features/ai-features.css";
import "./app-text/app-text.css";
