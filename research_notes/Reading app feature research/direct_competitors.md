# Direct competitors: LingQ, Lute v3, LWT (HugoFara fork), Readlang, and newer readers

Researched 2026-10-30. Budget-limited pass (about 20 tool calls). GitHub API was rate-limited partway through, so Lute issue data is from one snapshot, and HugoFara LWT issue/release data could not be pulled. Reddit threads were mostly unreachable (auth walls / no snippets), so user-sentiment evidence is thinner than wanted and leans on forum posts, Trustpilot and review sites.

Baseline app (ours) already has: status coloring, translations, pronunciation, parent terms, multi-word terms, dictionaries panel, keyboard nav, pages/bookmarks/mark-as-read, paste/file/URL import, Wikipedia/RSS suggestions ranked by unknown share, FSRS with in-book example sentences, frequency bands, Claude tutor over MCP, Zen mode, phone layout. Lacks: audio/TTS, stats/charts, daily goal, sentence translation, images, Anki export, browser extension.

## What features does each product have (reading UI, lookup, audio/TTS/sync, stats, goals/streaks, SRS, import, mobile/offline, export/Anki, community/library)?

### Takeaway
Against our app, the competitors share a few things we don't have: **audio** (attach audio to a book, or TTS), **sentence or page translation**, **term images**, **Anki export**, and **some kind of progress or stats tracking**. LingQ and Readlang also have **goals or streaks** and **browser extensions with YouTube/Netflix import**. Lute is closest to our app and deliberately has **no SRS** ("reading only"), so our FSRS review and AI tutor already set us apart from it.

### Cited Findings

**Lute v3 (self-hosted, Python/Flask, ~1.6k GitHub stars, last push 2026-09-05)**
- About 1,603 stars, last pushed 2026-09-05 — [GitHub API repo metadata](https://api.github.com/repos/LuteOrg/lute-v3)
- Core: languages and dictionaries, texts, terms and multi-word terms, parent terms that share definition and sample sentences, word images — [Lute manual](https://luteorg.github.io/lute-manual/)
- Dictionaries come in two kinds: term dictionaries (tabs) and sentence dictionaries, each embedded or pop-up. `t` translates a sentence and `Shift+t` translates a paragraph, so sentence translation works through an external dictionary/translator URL, not a built-in MT engine. Book import takes .txt, .epub, pasted text or a web page, and can split pages by sentences or paragraphs. Per-book unknown-word % is computed from a page sample. Customizable hotkeys, focus mode (`f`), and themes (Auto/Light/Rust/Coal/Navy/Ayu plus custom CSS) — [Lute manual (print)](https://luteorg.github.io/lute-manual/print.html)
- Audio player for book audio (.mp3/.wav/.ogg; later m4a, AAC, FLAC, WebM) with play/pause, seek, speed, sticky player, and **audio-timeline bookmarks** to jump between. The manual says audio is *not* synced to pages and single-word audio is missing (no TTS) — [Lute manual (print)](https://luteorg.github.io/lute-manual/print.html); [release 3.10.1](https://github.com/LuteOrg/lute-v3/releases)
- Anki export needs Anki desktop + AnkiConnect. User-defined export specs set deck, note type, field mappings (term, translation, sentence, image, tags) and criteria. Export works from the reading screen (hover/menu/hotkey) or the term list, but not on mobile. CSV term import/export (export omits sentences and images). CLI jobs: `book_term_export`, `language_export`, `import_books_from_csv` — [Lute manual (print)](https://luteorg.github.io/lute-manual/print.html)
- **No SRS**: the manual says "Lute is designed for reading only, there is no testing" and sends users to Anki. Also no automated/bulk translation and no non-consecutive multi-word terms (e.g. German separable verbs) — [Lute manual (print)](https://luteorg.github.io/lute-manual/print.html)
- Mobile means connecting a phone to a running instance: tap opens the term form, long-tap starts a multi-word term. The app is described as desktop-first — [Lute manual (print)](https://luteorg.github.io/lute-manual/print.html)
- Parser plugins: Mandarin (3.4.0, May 2024), Thai (3.5.9), Khmer (3.6.0). Japanese uses MeCab. 50+ predefined languages, including Bosnian (3.5.0) and Farsi (3.3.2) — [Lute releases](https://github.com/LuteOrg/lute-v3/releases)
- Term images come from a Bing image search (3.9.5 made it async; 3.10.2 fixed random images) — [Lute releases](https://github.com/LuteOrg/lute-v3/releases)

**LWT – HugoFara fork (self-hosted PHP/MySQL, ~252 stars)**
- Text suggestions: Project Gutenberg books ranked by difficulty (easy/medium/hard from known vocabulary), plus curated news feeds for 19 languages — [HugoFara/lwt README](https://github.com/HugoFara/lwt)
- Wiktionary-based starter vocabulary (pre-enriched), click-to-translate, **bulk translation**, **TTS for pronunciation**, **audio sync**, spaced repetition in context, **progress statistics**, multi-word selection, responsive mobile design, themes, shortcuts, **video embedding**, MeCab for Japanese, position memory, **Anki export**, UI in 9 languages — [HugoFara/lwt README](https://github.com/HugoFara/lwt)
- Stack: PHP 8.2–8.5, MySQL/MariaDB, TypeScript/Vite frontend, a Python NLP service, Docker Compose. **Android companion app "Lukaisu"** (local-first, TTS, headed for F-Droid) is in development — [HugoFara/lwt README](https://github.com/HugoFara/lwt)

**LingQ (commercial SaaS, web + iOS/Android)**
- Daily goal is a number of new LingQs per day (13/25/50/100), and meeting it keeps a streak. Known-word count = status 4 "Learned" + "Known". Learned words stay in SRS, Known words don't. A daily email lists due LingQs. The doc is dated 2020 — [LingQ support: Understanding statistics](https://lingq-support.groovehq.com/help/understanding-lingq-statistics)
- Coins are earned by creating LingQs, raising statuses, making words known, listening and reading. Statistics cover LingQs created, known words, and hours of listening/reading/writing. One guide says statistics and challenges are Premium — [StoryLearning LingQ review](https://storylearning.com/lingq-review); [LingQ support: streak](https://lingq-support.groovehq.com/help/what-s-the-streak-and-how-do-i-maintain-it)
- YouTube and Netflix import through LingQ's import extension: captions become the lesson transcript. The free tier caps saved LingQs and imports — [StoryLearning LingQ review](https://storylearning.com/lingq-review)
- Large community library of lessons with audio, split into lessons/courses (a criticism below). Pricing about $8.99–14.99/mo — [StoryLearning LingQ review](https://storylearning.com/lingq-review)
- AI: "AI-Simplified Lesson" (generates simplified versions of lessons), natural-sounding TTS voices, Lynx AI chatbot tutor with web search, "Explain This" AI in v5.8.5, AI context-based translations, auto grammar tagging — [App Store listing](https://apps.apple.com/us/app/-/id379385811); [LingQ news: AI context-based translations](https://www.lingq.com/pl/news/lingq-launches-ai-context-based-translations/); [App Store (es) release notes summary via search](https://apps.apple.com/py/app/aprende-idiomas-con-lingq/id379385811)

**Readlang (commercial SaaS, web + Chrome/Firefox extension + iOS/Android)**
- Click any word or phrase on a text or **any web page** (Chrome extension, Web Reader extension, bookmarklet) to translate. Words are saved automatically as flashcards. Library of articles in genres (Fiction, Non-fiction, Songs) or upload your own — [readlang.com](https://readlang.com/)
- Free: unlimited single-word translations, 10 phrase translations/day, 10 AI context explanations/day. Premium ($6/mo, $48/yr): unlimited, context-aware AI translations, book-specific flashcards and export, high-quality word/phrase voices, **2 streak repairs/month**. Premium Plus ($15/mo, $120/yr): whole-text voices and stronger AI. Supports ~119 languages — [readlang.com](https://readlang.com/)
- Word list sorted by frequency. Practice modes beyond flashcards, including "Blitz" (Jun 2024). Notes on words/phrases (Dec 2024) — [Readlang forum Updates](https://forum.readlang.com/c/updates/6); [forum user post](https://forum.readlang.com/t/anyone-here-use-used-lingq-or-any-other-alternatives/123?page=4)

**Newer / indie readers**
- **LinguaCafe** (self-hosted, Laravel/Docker, ~1.5k stars, 176 open issues): reader with in-place lookup, flashcard review, vocabulary search, bundled dictionaries (JMDict, KANJIDIC2, CC-CEDICT, HanDeDict, Kengdic, Wiktionary-derived), 27 languages, Anki and Jellyfin integration (subtitle reading from a media server), EPUB and article import. Single-user, can use >2 GB RAM, no ARM support — [LinguaCafe GitHub](https://github.com/simjanos-dev/LinguaCafe)
- **Lingua Verbum**: built by ex-LingQ people and pitched as "what LingQ could have been". Chrome extension color-codes words on any web page by knowledge level, has an AI assistant, and **imports your LingQs**. iOS app id6745274152 (2025) — [App Store](https://apps.apple.com/app/id6745274152); [r/languagelearning post (title only reachable)](https://lr.psf.lt/r/languagelearning/comments/1jmltj2/exlingq_users_built_a_better_app)
- Other names from listings (not verified in depth): LingKuma (open-source LingQ-style web reader), Read Frog (open-source EPUB/subtitle reader with Anki mining), Yomimaru (graded Japanese reader), Typhon (open-source ebook reader with Rikai-style Japanese lookup and cross-device progress sync), BiReader (bilingual reader with adjustable difficulty) — [selfhostyourself.com](https://selfhostyourself.com/alternative-to/lingq); [trendshift](https://trendshift.io/repositories/123850); [AlternativeTo Yomimaru](https://alternativeto.net/software/yomimaru/); [AlternativeTo BiReader](https://alternativeto.net/software/bireader/)

### Inferences
- **Feature-gap catalogue vs our app**, with who has each feature and how:
  1. *Book audio player with bookmarks/speed* (Lute). *Audio sync to text* (LWT, Readlang YouTube sync, LingQ lesson audio). *TTS* (LWT, LingQ, Readlang paid voices, Lukaisu).
  2. *Sentence/paragraph translation hotkey* (Lute `t`/`Shift+t` via an external URL). *Context-aware AI translation* (LingQ, Readlang Premium). We already have Claude MCP, so an AI sentence gloss would be cheap to add.
  3. *Term images* (Lute through Bing search, exported to Anki).
  4. *Anki export* (Lute: configurable AnkiConnect mappings. LWT, LinguaCafe, Readlang Premium).
  5. *Stats* (LingQ: known words, LingQs, listening/reading hours, coins. LWT: progress stats. Lute: per-book unknown %, words-read tracking since 3.8.0).
  6. *Daily goal + streak* (LingQ: new LingQs/day with streak. Readlang: streaks with paid "streak repairs").
  7. *Browser extension / read-anywhere* (Readlang, LingQ import extension, Lingua Verbum).
  8. *YouTube/Netflix/subtitle import* (LingQ, Readlang YouTube sync, LinguaCafe via Jellyfin).
  9. *AI-simplified text* (LingQ) and *AI story generation* (Readlang Story Bot). Our MCP tutor could cover both.
  10. *Bulk term actions* (Lute 3.7.0), *term CSV import/export* (Lute, Readlang CSV word import).
- Readlang's streak repairs and LingQ's goal tied to "LingQs created" suggest that both monetize habit mechanics.

### Gaps
- Could not get the HugoFara LWT release list/issue reactions or ROADMAP.md (GitHub API rate-limited).
- No official LingQ changelog page was found. LingQ AI/TTS dates come from App Store listings and a third-party overview (stork.ai) and are unverified.
- Migaku, Language Reactor and Lingtuitive were not covered (search returned nothing useful).

## What have they added recently (2024–2026)?

### Takeaway
Lute shipped a burst of features in late 2024 to early 2025 (bulk actions, words-read tracking, custom hotkeys, mobile quick-status, Anki export), then switched to community bugfix releases in 2026. Readlang and LingQ have spent 2025–2026 almost entirely on **AI features** (context translations, explain, simplified lessons, chatbots, story generation, reading guides) plus **audio/voices** and **YouTube sync**.

### Cited Findings
- Lute 3.10.3 (2026-07-07) and 3.10.2 (2026-06-27): community bugfixes only (sentence translation fix, term image search fix, epub encoding, audio player in Night theme). Nothing from 3.10.1 (2025-03-10) to 3.10.2 — [Lute releases](https://github.com/LuteOrg/lute-v3/releases)
- Lute 3.10.0 (2025-02-23): flexible Anki export. 3.10.1: parent pronunciation in Anki mapping, more audio formats — [Lute releases](https://github.com/LuteOrg/lute-v3/releases)
- Lute 3.9.x (Jan 2025): "Quick set status" mobile mode (tap sets status 1), cleaned-up mobile menu, split by sentences/paragraphs, page navigation hotkeys, black-and-white theme, tracking when each page was started, a "peek" route — [Lute releases](https://github.com/LuteOrg/lute-v3/releases)
- Lute 3.8.0 (2024-12-25): more compact popup with more data, layout-independent hotkeys, and #527 tracking words read in a new `wordsread` table. 3.7.0 (2024-12-20): bulk term actions on the reading screen and term list. 3.5.7 (Oct 2024): customizable shortcuts. 3.5.8: hotkeys for prev/next unknown word. 3.5.6: bulk-import books from CSV. 3.5.5: book stats graphs ajaxed in. 3.5.0 (Jun 2024): text bookmarks; Bosnian added — [Lute releases](https://github.com/LuteOrg/lute-v3/releases)
- Readlang updates are listed by last-activity date, so the original dates may be earlier: Reading Guides (background info, glossary, spoiler-free plot summary; activity Oct 2026), Story Bot AI stories, conversational chatbot, voice update (Jun 2026), "AI Polish", Ask AI custom ChatGPT prompts, YouTube sync beta (Mar 2026), CSV word import (Feb 2026), Firefox extension (Nov 2025), ChatGPT context-aware translations, MP3 upload with automatic transcription (Apr 2025), furigana and pinyin (Jan 2025), word notes (Dec 2024), server-generated Read-Aloud voices (Sep 2024), 58 new languages and AI-Explain for all (Jul 2024), Blitz practice mode (Jun 2024) — [Readlang forum Updates](https://forum.readlang.com/c/updates/6)
- Readlang Firefox extension added transliteration for Japanese/Chinese/Cantonese (Dec 1, 2025) — [Firefox add-on versions](https://addons.mozilla.org/fr/android/addon/readlang-web-reader/versions/)
- LingQ: AI-Simplified Lessons, natural TTS voices, "Explain This" AI (5.8.5), TTS improvements (5.8.10), Lynx AI chatbot with web search. A third-party overview dates AI Chat to 2025 and simplified lessons to July 2025 (unverified) — [App Store](https://apps.apple.com/us/app/-/id379385811); [stork.ai overview (third-party)](https://www.stork.ai/en/lingq)
- LingQ users have built a community "LingQ Addon" userscript that adds AI TTS and an AI chat widget (updated 2026-05-05), which suggests the official features don't meet power users' needs — [Greasy Fork](https://greasyfork.org/scripts/533096-lingq-addon)
- Readlang's 2024–2026 changes from audio upload with auto-transcription through YouTube sync suggest audio-text alignment is now an expected feature

### Inferences
- The industry direction is AI glosses and explanations, AI-adapted or simplified text, and audio (TTS or synced). Our Claude MCP tutor already covers part of the AI direction. Audio is our largest remaining gap.
- Lute's slowdown (one year with no release after 3.10.1) leaves room for a self-hosted tool that keeps shipping.

### Gaps
- No exact original post dates for Readlang updates (the forum list shows last activity).
- No primary-source dates for LingQ 2025–2026 features.

## What do users praise and complain about?

### Takeaway
Users praise **reading authentic, whole texts**, **easy lookup** (Wiktionary, AI explain), **frequency-sorted word lists**, **a free tier that's actually usable**, and **known-word counts as motivation**. They complain about **bugs and stagnation** (LingQ), **paywalls and a stingy free plan**, **texts chopped into lessons**, **distracting libraries/news feeds**, **non-editable saved context**, **poor support and hard cancellation**, and, for self-hosted tools, **desktop-only/awkward mobile and setup**.

### Cited Findings
- A Readlang forum user (Dec 30, 2025) prefers Readlang because texts stay as written, not split into lessons. They rate the "Explain" feature far above LingQ's dictionaries, call Wiktionary integration seamless, find practice modes fun, like that the word list is ordered by frequency, call the library clean, the free plan usable and Story Bot nice for niche languages. On LingQ they find the library "distracting at best and anxiety-inducing" (unwanted news), dislike the lesson chopping and the small non-editable saved context, call the free plan "a joke", and deleted their account. They did find LingQ's known-words count motivating — [Readlang forum thread p.4](https://forum.readlang.com/t/anyone-here-use-used-lingq-or-any-other-alternatives/123?page=4)
- Another forum user: Readlang suits novels, literature, articles and Wikipedia, while LingQ is more of a listening-plus-reading learning app — [Readlang forum thread p.2](https://forum.readlang.com/t/anyone-here-use-used-lingq-or-any-other-alternatives/123?page=2)
- Trustpilot (2025): LingQ "WAS a good app" that kept shipping poorly implemented updates instead of fixing known issues. Reviewers also report unresponsive support, hard cancellation, and buyer's regret on annual plans — [Trustpilot LingQ](https://ie.trustpilot.com/review/lingq.com)
- Reviews: LingQ is "a little buggy and difficult to navigate" but good value — [Langoly](https://www.langoly.com/lingq-review/). It is worth paying for if you already read and listen a lot and want to import anything and track words, but weak for structured lessons, speaking, or leveled material — [StoryLearning](https://storylearning.com/lingq-review)
- A December 2025 r/languagelearning thread was titled "Complaints and more complaints" (content not retrievable) — [Reddit snapshot](https://reddit.sentinel-team.org/posts/1pjegew/snapshots/2025-12-11T00%3A20%3A58.99388Z)
- Lute: free, no limits, installed locally, desktop-oriented. Android via Termux is "a bit technical". Anki export requires desktop Anki — [macmyths Lute overview](https://macmyths.com/apps/lute/)
- Lute's own manual lists limitations users hit: page text can't be selected/copied normally, stats are sampled, bulk edit allows one parent, Docker is problematic on Windows — [Lute manual (print)](https://luteorg.github.io/lute-manual/print.html)
- LinguaCafe self-reports bugs, single-user only, >2 GB RAM, no Raspberry Pi/ARM — [LinguaCafe GitHub](https://github.com/simjanos-dev/LinguaCafe)
- Ex-LingQ users built Lingua Verbum, pitched as "what LingQ could have been". It imports LingQs, which suggests some users are looking for a way off LingQ — [App Store](https://apps.apple.com/app/id6745274152)

### Inferences
- Engagement drivers users name explicitly: a visible known-words count, a frequency-ordered word list, AI explain, and whole uninterrupted texts. Pain points to avoid: paywalls on lookups, forced lesson splitting, noisy content feeds, and locked-in saved sentence context.
- Our design (whole books, editable terms, Zen mode, ranked suggestions instead of a noisy feed) already matches what Readlang users praise. A known-words counter and growth chart look like the cheapest high-motivation addition.

### Gaps
- Direct Reddit comment text was not retrievable. No quantitative sentiment data was found.
- No LingQ forum feature-vote data found.

## Which features are most requested but missing in Lute/LWT?

### Takeaway
By GitHub reactions and comment counts, Lute users most want: **non-consecutive multi-word terms**, **audio sync with subtitles/SRT**, **TTS word pronunciation**, **YouTube import**, **word stats breakdown/unique-word counts**, **chapters/TOC**, **an EPUB reader**, **offline dictionaries (GoldenDict/Kobo)**, **an API**, and **ChatGPT/LLM integration**. Anki export (#3, the top-reacted issue) has since been delivered. Reaction counts are small (≤5), so this signal is weak.

### Cited Findings
Lute v3 issues by reactions (reactions/comments/state), snapshot 2026-10-30 — [GitHub issue search](https://github.com/LuteOrg/lute-v3/issues?q=is%3Aissue+sort%3Areactions-%2B1-desc):
- #3 Add opinionated Anki export: 5/8, closed (shipped 3.10.0)
- #9 Support non-consecutive multi-word terms: 5/6, open
- #648 Synchronize audio with srt subtitles: 4/1, open
- #36 Audio files for word pronunciation (TTS): 3/7, open
- #73 YouTube video import: 3/6, open
- #434 Vocabulary "mining" mode that auto-selects the next unknown word: 2/6, closed (prev/next unknown hotkeys in 3.5.8)
- #178 Word stats breakdown: 2/2, open. #180 Unique Words stat to Word Count: 0/13, open
- #98 User accounts (multi-user): 2/3, open
- #30 Book chapter markings and TOC: 2/5, open. #292 Add EPUB reader: 2/1, open. #56 Book package export/import: 2/1, open
- #581 Some dictionaries are unusable: 2/3, open. #652 chinese.yabla.com refuses embedding: 0/9 (iframe-blocking dictionaries are a recurring pain)
- #42 Custom fonts: 1/6, open. #198 More translation fields: 1/5, open. #211 Copy dictionary selection into Translation: 1/2, open
- #1 GoldenDict integration: 1/10, open. #228 Offline dictionary files: 1/11, open. #6 Kobo dictionary: open
- #297 API to the Lute backend: 1/11, open. #17 ChatGPT integration: 1/12, open
- #55 Import subtitle file with auto-bookmarks: open. #11 Korean parsing: open
- Most-commented: #86 annotated bookmarks (17, closed). #220 Writing Systems setting (17, open). #99 store all terms including unknown (15, closed). #685 random images bug (14). #66 sync status between parent and children (13, closed). #277 open a random book (9, closed)
- Lute docs confirm missing: no SRS, no TTS/single-word audio, no audio-to-page sync, no non-consecutive multi-word terms, no bulk/auto translation — [Lute manual (print)](https://luteorg.github.io/lute-manual/print.html)
- The HugoFara LWT fork already ships several of Lute's gaps: TTS, audio sync, SRS, progress stats, bulk translation, video embedding — [HugoFara/lwt README](https://github.com/HugoFara/lwt)

### Inferences
- For our app, the Lute requests we don't yet cover, roughly by signal × fit: (1) TTS/word pronunciation audio, (2) audio sync (SRT/subtitle alignment), (3) word stats/unique-word and known-word counts, (4) offline dictionaries (avoiding iframe-blocked sites), (5) non-consecutive multi-word terms (separable verbs; less relevant for our RU/ZH/FA/BS set, though Russian reflexive/particle constructions may benefit), (6) YouTube/subtitle import, (7) chapters/TOC and EPUB structure. We already cover ChatGPT/LLM integration (#17, via Claude MCP) and an API (#297, the MCP server).
- Lute's small user base means absolute reaction counts are tiny, so treat this as a direction rather than demand sizing.

### Gaps
- HugoFara LWT issue/reaction data not retrieved (rate limit). The fork has only 3 open issues per its README, so the signal there is probably minimal anyway.
- Lute GitHub Discussions were not checked.
