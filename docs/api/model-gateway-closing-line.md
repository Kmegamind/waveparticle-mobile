# writeClosingLine

`writeClosingLine({ facts, lastMoment, forbidTerms?, earlierLines? })` (#258, #41, END-TONE) returns `{ source: "generated", closingLine, carryLine }` or a failure. The model answers `{"closing_line","carry_line"}`. Both lines pass the existing one-way line checks (`CompanionKind` `closing_line` uses the default length: at most 3 sentences and 40 words) and the per-run list. The carry line is also checked against the closing line. The prompt says what happened to him that day and how he feels, never counts anything and never mentions pauses or the reader.
