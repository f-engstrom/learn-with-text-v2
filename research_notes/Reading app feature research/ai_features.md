# AI/LLM Features in Language-Learning Reading & Tutoring Apps (2025–2026)

Research date: 2026-10-30. Scope: what comparable reading and tutoring apps ship as LLM features, how they keep generated text at the right level, what research and learners say, and open-source prior art. Context: a self-hosted reader (Russian, Chinese, Farsi, Bosnian) with a Claude MCP tutor that already does word glosses, quizzing, Transfer judgement, highlights, bookmarks, lemma linking, imports and unknown-word-share Suggestions.

Source quality: product claims come mostly from vendor pages, app-store listings, LingQ marketing email (via milled.com) and one third-party directory (stork.ai, secondary). Learner feedback comes mainly from the Readlang forum; searches did not return usable r/languagelearning threads. Research findings come from arXiv, ACL Anthology, LLT, ReCALL and Schmitt et al. 2011. Several research findings are taken from abstracts only and are flagged where that matters.

## 1. Which apps offer which LLM features?

### Takeaway
The common, durable LLM features in reading apps are (a) context-aware "Explain" for a word, phrase or sentence, (b) one-click "Simplify this lesson", and (c) generated stories, increasingly built from the learner's own word lists. LingQ has added a chat/coach layer on top (conversation practice, example sentences, lessons on request, writing correction). Open-source LWT-family readers (Lute v3, LinguaCafe) appear to have no native LLM features, so an MCP-tutor reader is already ahead of them.

### Cited Findings

**LingQ (largest comparable "learn by reading" product)**
- Oct 23 2023: LingQ launched AI "content simplification" powered by OpenAI. One click turns a hard lesson into a beginner version "with simplified vocabulary and sentence structure". Learners can read the simplified version first and then return to the original. It was announced as available to all users. LingQ also added Whisper audio-to-text (99 languages) in May 2023. — [LingQ news: LingQ launches AI lessons](https://www.lingq.com/en/news/lingq-launches-ai-lessons/)
- A later Premium upsell email lists "Simplify lessons" among Premium features, which suggests it may now be paywalled. Unconfirmed. — [LingQ Premium Plus email (milled.com)](https://milled.com/the-linguist-institute/get-more-out-of-your-reading-and-listening-with-lingq-premium-plus-Op8H8IksCtshOOlX)
- LingQ has "AI Definitions" and "Explain This" for context-aware conceptual explanations. A third-party directory dates simplification to July 2025, which conflicts with LingQ's own Oct 2023 announcement. Prefer the LingQ date. — [stork.ai LingQ summary (secondary)](https://www.stork.ai/en/lingq); [LingQ news](https://www.lingq.com/en/news/lingq-launches-ai-lessons/)
- App Store release notes mention "Explain This" being available in notes (v5.8.5). — [App Store LingQ listing](https://apps.apple.com/py/app/aprende-idiomas-con-lingq/id379385811)
- Premium includes "conversation practice with Lynx AI". **Premium Plus** adds "Lynx Coach", a companion that "adapts to your goals and historical activity". The email says you can ask it what to read today, to generate example sentences, or to generate a lesson matching your interests and proficiency. Plus also adds ElevenLabs voices and 6× transcription. — [LingQ Premium Plus email](https://milled.com/the-linguist-institute/get-more-out-of-your-reading-and-listening-with-lingq-premium-plus-Op8H8IksCtshOOlX)
- The directory says Premium Plus also includes writing correction, live tutoring credits and an "advanced AI chat" (2025). This is secondary and does not fully match the email's framing. — [stork.ai](https://www.stork.ai/en/lingq)
- Readlang-forum users comparing the two (older posts) said Readlang's Explain was more accurate and that LingQ lacked explanations. One user praised LingQ's simplification. — [Readlang forum: LingQ alternatives](https://forum.readlang.com/t/anyone-here-use-used-lingq-or-any-other-alternatives/123)

**Readlang**
- Mar 2023: added "smart definitions", a sentence-aware definition tab using ChatGPT. Jun 2023: added context-aware explanations. Later, all languages got AI Explain support. — [Readlang blog: smart definitions](https://blog.readlang.com/2023/03/23/smart-definitions.html); [Readlang blog: context-aware explanations](https://blog.readlang.com/2023/06/27/z1-context-aware-explanations.html); [Readlang forum: 58 new languages, all with AI Explain](https://forum.readlang.com/t/blog-post-58-new-languages-just-landed-all-languages-now-have-ai-explain-support/81)
- Explain can take an arbitrary sentence as context (forum thread). Users also requested whole-sentence translation as a separate feature. — [Readlang forum: Explain arbitrary sentence](https://forum.readlang.com/t/explain-ai-can-receive-an-arbitrary-sentence-as-context/4666); [Readlang forum: whole sentence translated](https://forum.readlang.com/t/ability-to-see-whole-sentence-translated/3600)
- Mixed feedback on Explain. One premium user found explanations "very inadequate… basically a dictionary definition", while others found them good for nuance in advanced texts. One user reported a context mix-up: Explain referenced a Kurdish sentence while they were reading Somali. — [Readlang forum: How do I use Explain](https://forum.readlang.com/t/how-do-i-use-the-explain-feature/5072)
- **Story Bot** (launched Nov 26 2024, Premium). Users pick a category, title or idea and a difficulty level. Generation takes under a minute, and stories are auto-shared to a public library. Users can paste word lists (Readlang exports, Duolingo vocab), and "most words are typically used, though not all". Bracketed instructions can target grammar points. The developer said generating from the user's learning words was planned but not built. — [Readlang forum: NEW Story Bot](https://forum.readlang.com/t/new-story-bot-for-ai-generated-stories/1309)
- Story Bot complaints: bland, repetitive output with "a certain similarity of literary style (and final moral)" and a recurring character "Carla". It produced English inside Arabic stories (Jan 2025) and used the passé simple in French. It refused some prompts with directives and was finicky about prompt phrasing. Praise: "brilliant" for beginners, good level-appropriate input, good for listening before reading. One user would choose AI text over human text only "if it accelerates my learning". — [Readlang forum: Story Bot](https://forum.readlang.com/t/new-story-bot-for-ai-generated-stories/1309)
- An earlier user feature request asked for AI text generated from recently looked-up words. A reply noted you can paste the list into a chatbot yourself, "with mixed success". — [Readlang forum: feature request](https://forum.readlang.com/t/feature-request-ai-generated-text-from-recently-looked-up-words-and-phrases/1680)
- Readlang also published a post on review via AI summaries (May 2024). — [Readlang blog: review summaries](https://blog.readlang.com/2024/05/22/review-summaries.html)

**Story-generation apps (vendor-only claims, unverified)**
- LinguaStory: about 150-word stories at the learner's level, embedding 8–10 new words. Due SRS vocabulary is turned into personalized review stories, and Premium allows any topic. — [App Store: LinguaStory](https://apps.apple.com/app/id1474989992)
- TaleGPT: stories by CEFR level A1–C2, tailored to interests. — [App Store: TaleGPT](https://apps.apple.com/app/id6741117029)
- LingoGPT (released Jan 2026): keyword- or theme-to-story. — [mwm.ai LingoGPT](https://mwm.ai/apps/lingogpt-language-learning/6757350976)
- MeloLingua (Feb 2026 listing): lessons built around the learner's life and interests. A review notes that dynamically generated content "is not verified by a teacher or any human". — [actualfluency.com MeloLingua review](https://actualfluency.com/melolingua)
- Beelinguapp has a blog post on using AI to craft its stories. Its current per-user generation features were not confirmed. — [Beelinguapp blog](https://beelinguapp.com/blog/ai-and-beelinguapp:-crafting-the-perfect-stories-for-language-learning)

**Open-source LWT family**
- Lute v3's release notes show Bing translation and wordreference lookups but no AI or ChatGPT integration. — [Lute v3 releases](https://github.com/LuteOrg/lute-v3/releases)
- LinguaCafe offers dictionaries plus DeepL machine translation (500k characters/month free); no LLM feature was found. — [LinguaCafe issue #248](https://www.github.com/simjanos-dev/LinguaCafe/issues/248)
- The LWT maintainer recommends lute-v3 as the successor. — [hugofara/lwt](https://github.com/hugofara/lwt)

### Inferences
- Feature matrix as found:

| Feature | LingQ | Readlang | Story apps | Lute/LinguaCafe |
|---|---|---|---|---|
| Sentence/phrase Explain | Yes | Yes | n/a | No |
| Whole-sentence translation | via MT | user-requested | n/a | MT (DeepL/Bing) |
| Simplify a lesson | Yes | not found | n/a | No |
| Generated stories | Lynx Coach | Story Bot | core | No |
| From the learner's own words | via Coach (claimed) | paste list | LinguaStory | No |
| Conversation | Lynx AI | not found | n/a | No |
| Example sentences | Lynx Coach | not found | n/a | No |
| Writing correction | Plus (claimed) | not found | n/a | No |
| AI TTS | ElevenLabs (Plus) | not found | some | No |

- The "Explain" button is the most widely adopted and least controversial feature. Its main failure modes are explanations that read like a dictionary definition and wrong-context mix-ups. A tutor that already has the sentence, the book and the learner's word statuses can do better than both.
- The repeated complaint about story generators is sameness: same style, same moral, recurring characters. Variety needs deliberate effort, such as genre or author-style seeds, retelling public-domain plots, or continuing a book the learner is already reading.
- Comprehension questions, mnemonics and AI images were not found as headline features in the products checked. Absence of evidence, not evidence of absence.

### Gaps
- No primary LingQ changelog for Lynx/Explain dates or exact Premium vs Plus split; the stork.ai claims are secondary.
- Langotalk, Readle, Lingua.ly, Fluent and Glossika AI features were not confirmed by any source in this pass; the named-app search returned nothing for them.
- Duolingo Max (Explain My Answer, Video Call) and Speak/Praktika-style conversation apps were not researched in this pass.
- No source checked how well any of these features work specifically for Russian, Chinese, Farsi or Bosnian. Bosnian and Farsi are low-resource relative to the others, and LLM quality for them is unverified here.
- Reddit r/languagelearning sentiment was not retrieved; the search returned no Reddit threads.

## 2. How do they keep generated text at the right level?

### Takeaway
Most products just prompt for a level (CEFR or "beginner") and do not verify the result. The better approaches pair generation with a coverage check against a word list or the learner's known words (NGSL Profiler loop; SRS-Stories). Even word-list prompting only gets "most" target words in, so post-generation verification and regeneration is the practical pattern.

### Cited Findings
- NGSL Graded Story Creator (custom GPT) generates at seven cumulative levels, from the first 400 words to the full 2,800-word NGSL. It "aims for approximately 95–98% coverage at the selected level", may include a few above-level words for pre-teaching, and does not itself verify coverage. Users are told to check output in NGSL Profiler. — [NGSL AI tools](https://www.newgeneralservicelist.com/aitools)
- NGSL Profiler measures coverage against a level, flags out-of-level words, lets teachers mark words learners already know, and handles more than 100k proper nouns. Its benchmark: below roughly 90% coverage, the text likely needs revision. Its built-in Generator and Rewriter follow an "analyse → adjust → shorten → re-check" loop. — [NGSL AI tools](https://www.newgeneralservicelist.com/aitools)
- The NDL Kids Story Creator targets about 98% known vocabulary. Out-of-level words that matter are handled by pre-teaching up to three keywords and recycling them through the story. — [NGSL AI tools](https://www.newgeneralservicelist.com/aitools)
- SRS-Stories (Kamzela, Lango, Dušek; EMNLP 2025 Industry; arXiv Dec 2025) generates stories using only words the user knows, plus a few new words introduced in context and recent words reviewed, all scheduled by an SRS. It compares 3 generation methods × 3 constraint-enforcement strategies in English, Chinese and Polish. Its stories were judged more grammatical, coherent and better at showing word usage than constrained beam search. — [arXiv 2512.18362](https://arxiv.org/abs/2512.18362); [ACL Anthology 2025.emnlp-industry.44](https://preview.aclanthology.org/setup/2025.emnlp-industry.44)
- Readlang Story Bot uses a difficulty selector plus an optional pasted word list. "Most words are typically used, though not all"; there is no coverage verification. — [Readlang forum](https://forum.readlang.com/t/new-story-bot-for-ai-generated-stories/1309)
- LinguaStory claims level-matched stories with 8–10 new words embedded (vendor claim). — [App Store](https://apps.apple.com/app/id1474989992)
- Research describes controlling the grade level of AI-generated narratives as "a significant challenge", motivating a readability-driven prompting framework. — [IJACSA Vol 17 No 1, Readability Driven Prompting Framework](https://thesai.org/Downloads/Volume17No1/Paper_9-A_Readability_Driven_Prompting_Framework.pdf)
- Alfter (NLP4CALL 2024) examined whether generative LLMs can produce graded vocabulary lists out of the box. — [ACL Anthology 2024.nlp4call-1.1](https://aclanthology.org/2024.nlp4call-1.1)

### Inferences
- The app already has the hard part: per-learner word statuses, lemma linking and an unknown-word-share metric. A "generate, tokenize and lemmatize, compute unknown share, regenerate or replace offending words" loop would give real coverage control that most commercial products lack. Target roughly 95–98% known tokens, with N chosen new or learning words deliberately included and highlighted.
- The NGSL pre-teach pattern (up to three keywords, recycled through the text) and the SRS-Stories pattern (new words plus review words) map naturally onto the existing tutor: gloss up front, then quiz afterwards.
- Inflection-heavy languages (Russian, Bosnian, Farsi) need coverage computed on lemmas, not surface forms, which the app's form-to-dictionary-form linking already supports. Chinese needs word segmentation. SRS-Stories' inclusion of Chinese and Polish (a Slavic, inflected language) suggests the approach is feasible for these language types.

### Gaps
- The SRS-Stories abstract page gives no numeric coverage achieved and no code link; the full PDF was not read in this pass.
- No product publicly documents a verified coverage loop. Whether LingQ's Simplify or Lynx lessons use the learner's known-word data is undocumented.

## 3. What do learners and SLA researchers say about AI-generated vs authentic texts, and about coverage thresholds?

### Takeaway
Coverage research supports roughly 95% as a minimum and 98% for comfortable unassisted reading, but the relationship is roughly linear rather than a hard cliff, and the 98% figure did not fully replicate. Evidence that AI simplification actually improves comprehension is weak: one 2025 controlled study found no benefit over the original once topic familiarity was controlled. Learners value AI text mainly as a beginner bridge and dislike its blandness.

### Cited Findings
- Hu & Nation (2000) proposed 98% coverage as "sufficient" and 95% as "minimal" for adequate comprehension. — [Schmitt, Jiang & Grabe 2011 (PDF)](https://www.lextutor.ca/cover/papers/schmitt_etal_2011.pdf); [JALT TLT 37.4](https://jalt-publications.org/sites/default/files/pdf-article/37.4tlt_art1.pdf)
- Schmitt, Jiang & Grabe (2011) tested every coverage point from 90% to 100% and found a roughly linear relationship with comprehension. They conclude there is probably no single threshold such as 98% above which good comprehension occurs. — [Schmitt et al. 2011](https://www.lextutor.ca/cover/papers/schmitt_etal_2011.pdf); [NAU record](https://experts.nau.edu/en/publications/the-percentage-of-words-known-in-a-text-and-reading-comprehension/)
- A replication of Hu & Nation (Kremmel et al., AILA 2021 abstract) reports the original results "could not be fully replicated". — [AILA 2021 abstract](https://aila2021.dryfta.com/program/abstract-archive/abstract/public/416/unknown-vocabulary-density-reading-comprehension-and-the-98-coverage-figure-replicating-hu-nation-2000)
- A corpus analysis of graded readers found that publisher headword counts tend to overestimate the word types needed for 95% coverage. Graded readers start reaching 95% coverage at roughly the 1,700 rank of the New GSL. — [Temple dissertation](https://scholarshare.temple.edu/handle/20.500.12613/8955?show=full)
- Murphy Odo (2025, *Language Learning & Technology* 29(1)) compared an original passage with human-expert and AI simplifications. Once topic familiarity was accounted for, neither simplification was easier to comprehend than the original: "AI-generated simplified text does not yet improve L2 learners' comprehension". The author argues AI simplification focuses only on linguistic complexity and drops helpful information and cultural references. (Abstract only; sample size not read.) — [LLT item 1186](https://www.lltjournal.org/item-detail/1186/)
- Fredrick & Craven (2025, *Frontiers in Education*): advanced vocabulary and complex syntax in AI text may hinder readability for instruction. — [Frontiers in Education 2025](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1616935/pdf)
- Learner voices (Readlang forum): AI stories are good for beginners and level-appropriate input, but many prefer "real stories written by people" unless the AI content speeds up learning. Complaints include a repetitive style, recurring morals and characters, and language leakage. — [Readlang forum: Story Bot](https://forum.readlang.com/t/new-story-bot-for-ai-generated-stories/1309)
- Hanzi Hero community (Chinese learners) on a DIY AI graded reader: "really useful if its current problems get resolved". — [Hanzi Hero: yaya.press](https://community.hanzihero.com/t/diy-graded-reader-yaya-press/47)
- WaniKani community (Japanese learners) has a thread on AI stories using vocabulary from the learner's current level. Content not read in detail. — [WaniKani community](https://community.wanikani.com/t/ai-generated-stories-using-vocab-from-your-current-level-reading-practice/74315)
- Conversation practice evidence:
  - Hou & Min (2025, ReCALL) meta-analysed dialogue-based CALL for speaking development (16 studies, 89 effect sizes), but note that most systems studied were rule-based, not GenAI. — [ReCALL meta-analysis](https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/31847710516602398819C5E594038E7B/S0958344025100268a.pdf/dialogue-based-computer-assisted-language-learning-systems-for-second-language-speaking-development-a-three-level-meta-analysis.pdf)
  - Small single studies report reduced L2 anxiety with ChatGPT practice. — [WorldCALL 2023 (preliminary)](https://papers.iafor.org/wp-content/uploads/papers/worldcall2023/WorldCALL2023_75518.pdf); [JL3T Dec 2025](https://doaj.org/article/795a8beda7374b28a05752a4a3f74774)
  - A 2025 systematic review reports speaking gains from AI chatbots. — [Mahidol repository: AI chatbots systematic review](https://repository.li.mahidol.ac.th/handle/123456789/110298)
  - A 2026 Character AI study found that lower-anxiety learners improved more. — [TESL Quarterly (Shiraz)](https://tesl.shirazu.ac.ir/article_8152_730d808f29ed89d566ba25f8f757f00f.pdf)
  - Polizzi et al. caution that evaluations focus on the technology rather than interactionist pedagogy. — [Polizzi et al.](https://cris.unibo.it/retrieve/handle/11585/1067810/629e689d-8f23-480a-a199-169f3fafb5e6/02%2BPolizzi%2B13-54.pdf)
- An arXiv 2026 paper proposes level-appropriate embodied conversational agents to reduce foreign-language anxiety (not read in detail). — [arXiv 2607.21887](https://arxiv.org/pdf/2607.21887)

### Inferences
- Coverage is a dial, not a gate. The existing unknown-word-share Suggestions ranking is well-founded. Showing the learner an estimated coverage figure (around 95% minimum, around 98% comfortable) is defensible, but a hard cutoff is not.
- Given Murphy Odo's result, "simplify this passage" is better framed as a scaffold (read the simple version, then the original, as LingQ suggests) than as a replacement. It should keep content and cultural references rather than only reducing syntax.
- For a learn-by-reading app, the best-supported AI features stay closest to authentic text: sentence explanation and translation on demand, glosses, and comprehension or discussion questions about the actual book. Generated stories are most useful at beginner level (where authentic text is out of reach) and as targeted review of learning words.
- Conversation practice has positive but weak, small-sample evidence, mostly on anxiety. It is the furthest from the app's core "reading" mission. Discussion of the text just read is a cheaper middle ground and reuses the tutor.

### Gaps
- Full texts of Murphy Odo (2025) and Fredrick & Craven (2025) were not read; sample sizes, languages and models are unknown.
- No study found on comprehension questions or "discuss the text" features in reading apps specifically.
- No study found comparing learning gains from AI stories built from known words versus authentic graded readers.
- No evidence was retrieved on AI-generated mnemonics or images for vocabulary.
- Coverage thresholds come almost entirely from English-L2 research; no Russian, Chinese, Farsi or Bosnian-specific threshold studies were found.

## 4. Notable open-source projects doing LLM plus vocabulary-aware text generation

### Takeaway
There is little open-source prior art. SRS-Stories is the key research reference but has no code link on its arXiv page. GradReader is a small Streamlit plus OpenAI story-pack generator without evident vocabulary control. Older corpus-driven graded-reader tools are non-LLM. The LWT, Lute and LinguaCafe ecosystem has no LLM integration, so this app would be early here.

### Cited Findings
- SRS-Stories (EMNLP 2025 Industry) does vocabulary-constrained, SRS-scheduled, multilingual story generation (English, Chinese, Polish). The arXiv page shows no code repository. — [arXiv 2512.18362](https://arxiv.org/abs/2512.18362)
- GradReader (dnardiapp-coder): a Streamlit app wrapping OpenAI text generation and TTS to build "mini story packs" by level and language. Vocabulary control is not listed. — [GitHub: GradReader](https://github.com/dnardiapp-coder/GradReader)
- jtauber/graded-reader: corpus-driven, computer-generated graded-reader sequencing (non-LLM), archived May 2020. The author points to the newer "sequencing-tools". — [GitHub: jtauber/graded-reader](https://www.Github.com/jtauber/graded-reader)
- graded-reader-builder (danielt998) builds graded readers from story, vocabulary and character input; AI use is not confirmed. — [GitHub: graded-reader-builder](https://github.com/danielt998/graded-reader-builder)
- The NGSL tools (Profiler plus custom GPTs) are free to use, but no open-source code was confirmed. — [NGSL AI tools](https://www.newgeneralservicelist.com/aitools)
- Lute v3 and LinguaCafe have no LLM features (see section 1). — [Lute v3 releases](https://github.com/LuteOrg/lute-v3/releases); [LinguaCafe issue](https://www.github.com/simjanos-dev/LinguaCafe/issues/248)
- The LingQ Addon userscript (Greasy Fork) extends LingQ's web reader; its AI features were not inspected. — [Greasy Fork: LingQ Addon](https://greasyfork.org/pl/scripts/533096-lingq-addon)

### Inferences
- The SRS-Stories design is the closest blueprint for a "story from my learning words" feature: known-word-only text plus a handful of scheduled new and review words, with constraint enforcement through prompting and verification rather than constrained decoding. The app's existing word-status, Transfer and quiz data could drive the word selection.

### Gaps
- Did not search GitHub exhaustively, e.g. for "comprehensible input generator", Anki plus LLM story add-ons, or "yaya.press".
- The SRS-Stories constraint strategies and any released code are unknown without reading the full PDF.
