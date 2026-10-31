# Progress slices

A quiet record of how far you've come. Each slice goes from the screen to the database and ends in something you can demo, and each works without the ones after it. Vocabulary follows [CONTEXT.md](../CONTEXT.md); Status history is in [ADR 0005](adr/0005-status-history-recorded-by-the-database.md). Numbering continues from [Practice](practice-slices.md).

Progress is shown, never demanded: no streaks, no reminders, nothing marked as missed. A broken streak that is pointed out makes people less likely to carry on, even when the break wasn't their fault ([report](../reports/Reading%20app%20feature%20research.md)). Words read leads, because it is the measure reading research gives meaning to.

### 24. Status history and Words read
- The database records every change of a Term's Status, including its creation and deletion, whoever makes it: the reading screen, Mark as read, the Term list or the Tutor. Terms saved before the history began count from the day they were saved, at their present Status.
- Each Page knows how many Words it has, so Words read is a sum, dated by when each Page was marked Read.
- **Demo:** save a Term, make it Known, then delete it; the history shows three changes.

### 25. The Progress page
- Per Language: Words read, with the last Milestone passed and the next; Reading days this week, as seven dots that fill on days you read, reviewed or saved a Term; Words read per week for twelve weeks; Known Terms over time; and the Due forecast for the next fourteen days.
- **Demo:** mark two Pages Read; Words read grows by their Words, today's dot fills, and this week's bar rises.

### 26. The day so far
- Marking a Page Read shows what today added in that Language: Words read, new Terms, Terms now Known, and Reviews. It goes away when you dismiss it or move on.
- **Demo:** mark a Page Read with the rest Known; the next Page opens with "Today: 250 Words read · 2 new Terms · 31 now Known".
