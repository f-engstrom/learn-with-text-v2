---
name: find-components
description: "Find pieces of the Reader's screens that should be shared components or theme rules, and suggest (or carry out) extracting them into src/lib/components or src/app.css. Use when asked to find or suggest components to extract, tidy the screens' styles, make a look the same everywhere, or before restyling something that appears in more than one screen."
---

# Find components

A look that shows in more than one place belongs to the theme (`src/app.css`) or to a component in `src/lib/components/`, with its story, so it is the same everywhere and changes in one place. This flow finds where a screen still carries its own copy, and says which home each copy should have.

Read `CLAUDE.md`'s "Checking how something looks" and the list of shared pieces first, and name things with the words in `CONTEXT.md` (Status, Source, Due, Term, …).

## 1. Scan

From the repository root:

```bash
python3 .claude/skills/find-components/scan.py
```

It reads every `<style>` block in `src/**/*.svelte` (stories left out) and prints three lists:

- **Identical declaration blocks in 2+ files**: the same rules under different names. The strongest sign of a missing component or theme rule.
- **Class names styled in 3+ files**: one idea (`.note`, `.source`, `.due-2`) restyled screen by screen.
- **Theme tokens read outside `app.css`**: a screen mapping a token itself, such as `var(--status-learning1)` or `var(--due-2-text)`. When the theme already has a class for it (`status-<Status>` sets `--status`), the screen should use the class.

The scan finds candidates and nothing more. Most layout-only matches (`display: flex; gap: 0.5rem`) are noise.

## 2. Check each candidate

For each cluster, open the files and compare the markup as well as the styles:

1. **Is it one idea?** Same meaning in the domain (a Translation's Source, how Due a Term is), not just the same CSS. Two things that only look alike stay apart.
2. **Does a home already exist?** Search `app.css` and `src/lib/components/` first. A screen that redeclares a theme rule (`.note`, `.error`, `.card`) should just delete its copy. A screen that hand-styles something a component already does (a Tag) should use the component, with a new `tone` or prop if one is missing.
3. **Do the copies disagree?** Where two copies differ (a pill radius in one, `0.25rem` in another), that's a drift to settle, not keep. Say which one wins.
4. **Which home?**
   - **Theme class in `app.css`**: a colour or mark keyed by a domain value, used on many elements (`status-<Status>`, Due levels). Show it in `src/stories/theme`.
   - **Component in `src/lib/components/`**: markup plus style plus maybe a prop or two (a Source pill, a labelled stat). Add `Foo.stories.svelte` beside it, with a story for each state.
   - **Component beside its screen**: two near-identical parts of one screen (the reading screen's Wiktionary and Azure panels). Use a shared component or snippet there, not in `lib/components`.
   - **Leave it**: layout glue of two or three lines.

## 3. Report

Give a ranked list, strongest first. For each candidate, give:

- the name, in the project's words, and its home (theme class, shared component or local)
- where it is now (`file:line` for each copy)
- what differs between the copies and which version wins
- its props or classes and the stories it needs

Recommend which to do first, then stop and ask before extracting.

## 4. Extract (once the user says which)

One candidate per commit:

1. Take visual snapshots first: run `pnpm test:visual:update` while the screens still look as they did.
2. Write the component or theme rule, with its story, and replace every copy. Delete the screens' own rules for it.
3. Run `pnpm test:visual`. Every story that moved should have moved on purpose. Look at the diff images in `.vitest-attachments`.
4. Add a new shared component to the "Shared pieces of the screens" row in `CLAUDE.md`.
5. Commit, saying what moved and any look that changed (the drift you settled).
