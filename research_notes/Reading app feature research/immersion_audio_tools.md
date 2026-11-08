# Immersion and audio language tools: features a reading app could borrow

Scope: Migaku, Language Reactor, Toucan, Kindle Word Wise / Vocabulary Builder, Lingopie, Yomitan/Yomichan, asbplayer, Trancy, and the open technology behind them (Web Speech API, Piper, Kokoro, edge-tts/Azure, WhisperX, youtube-transcript-api, Web Share Target). Researched 2026-10-30. Many tool pages and reviews are older, and dates are marked where known. Most sources are vendor docs or community lists. Few independent benchmarks exist.

## How does each tool implement audio, mining/card design, importing and passive exposure, and what do users say works?

### Takeaway
Across the category, the sentence card is a capture of context: the word, the sentence it came from, a cloze version of that sentence, audio (a native clip, a recorded media clip, or TTS), an image or screenshot, the source URL or title, and a definition. Cards reach Anki through AnkiConnect, either as new notes or by updating the last card added. Passive exposure (Toucan word swaps, Kindle Word Wise hints) works at word level and lets the user set how dense it is. The app already has most of the reading pieces. What it lacks is the capture pipeline: audio/TTS per sentence, rich card fields, an Anki bridge, and ways to bring text in.

### Cited Findings

**Yomitan / Yomichan (popup dictionary plus Anki card creation)**
- Yomitan creates Anki cards through the AnkiConnect add-on, so Anki must be running. On Android it needs AnkiDroid plus the unofficial AnkiconnectAndroid tool — [Yomitan wiki: Anki](https://yomitan.wiki/anki/)
- Users map Anki note fields to markers. Sentence and cloze markers include `{sentence}`, `{cloze-prefix}`, `{cloze-body}` and `{cloze-suffix}`. Others are `{popup-selection-text}`, `{search-query}`, `{audio}`, `{url}`, `{document-title}`, `{screenshot}`, `{clipboard-text}` and `{clipboard-image}` — [Yomitan wiki: Anki](https://yomitan.wiki/anki/)
- Duplicate check: an option flags existing cards and can block or allow adding. Anki checks duplicates on the model's first field, so the docs advise putting a unique field such as `{expression}` first — [Yomitan wiki: Anki](https://yomitan.wiki/anki/)
- Experimental "note generation": paste a newline-separated list of terms to bulk-create notes in Anki or export them to a file. Media is included only when sending to Anki, not in file export — [Yomitan wiki: Anki](https://yomitan.wiki/anki/)
- Card contents use Handlebars templates that advanced users can edit. The `{audio}` partial emits an Anki `[sound:...]` tag only when audio exists. If no audio is found, the older Yomichan played a short click instead. (Yomichan era, older) — [Yomichan default templates](https://github.com/FooSoft/yomichan/blob/2ee3e3a7a18cc8cb71febe3030c149e0280ed9a7/ext/data/templates/default-anki-field-templates.handlebars); [Yomichan README history](https://git.foosoft.net/alex/yomichan/commit/8adf83df4127099fb39fe57e902ca88b7748efe1)
- AnkiConnect can download audio from a URL and embed it in a new note, and the audio member is optional — [AnkiConnect repo](https://git.foosoft.net/alex/anki-connect/src/commit/910ca48d838afa357aaf2f22bc123ab791683d77)

**asbplayer (subtitle player and media miner)**
- Card fields: sentence, definition, word, custom fields, source, URL, tags, audio and image. Every text field can be edited before export — [asbplayer docs: mining in depth](https://docs.asbplayer.dev/docs/guides/mining-in-depth)
- Three export modes: export a new card, update the last card, or open Anki's own card creator pre-filled — [asbplayer docs: mining in depth](https://docs.asbplayer.dev/docs/guides/mining-in-depth)
- The "dialog-less" workflow pairs it with Yomitan. The user makes the card in Yomitan, then presses Ctrl+Shift+U so asbplayer adds the screenshot and audio to the last card. Ctrl+Shift+X opens the export dialog. Docs call Yomitan the most popular pairing — [asbplayer docs: mining subtitles](https://docs.asbplayer.dev/docs/getting-started/mining-subtitles); [asbplayer settings](https://docs.asbplayer.dev/docs/reference/settings)
- Audio is recorded from the video source for the subtitle's time range. Settings add padding before and after the subtitle, measured in ms. For local files the clip updates when you change the range. For streaming video you re-record. The dialog lets you play or download the clip — [asbplayer docs: mining in depth](https://docs.asbplayer.dev/docs/guides/mining-in-depth); [asbplayer settings](https://docs.asbplayer.dev/docs/reference/settings)
- Setup requires adding `https://app.asbplayer.dev` to AnkiConnect's `webCorsOriginList`. This is the CORS pattern a self-hosted web app would also need — [asbplayer docs: mining subtitles](https://docs.asbplayer.dev/docs/getting-started/mining-subtitles)
- The mobile website has a "Mine Subtitle" button in the overlay, and there is an Android guide — [asbplayer docs: mining in depth](https://docs.asbplayer.dev/docs/guides/mining-in-depth)
- Known limitation: screenshot cropping fails when the site plays video inside an iframe, so you mine in fullscreen — [asbplayer settings](https://docs.asbplayer.dev/docs/reference/settings)

**Migaku (browser extension plus SRS)**
- Cards can hold the target word, the context sentence, a native-speaker recording, an audio snippet from the show, a screenshot, a definition and a translation — [Migaku blog: card creation from video](https://migaku.com/blog/youtube/card-creation-from-video-content-migaku-browser-extension); [Migaku: card creation from text](https://migaku.com/blog/youtube/card-creation-from-text-content-migaku-browser-extension)
- Keyboard flow: hover a word and press "E" to open the card creator, or "Q" to send a card straight to Migaku Memory or Anki — [Migaku: card creation from text](https://migaku.com/blog/youtube/card-creation-from-text-content-migaku-browser-extension)
- Extension v1.3.0 (Nov 2023, older) added Google-TTS sentence audio and DeepL translation in the card creator. The popup dictionary began showing how many times you had seen a word — [Migaku on X](https://x.com/MigakuOfficial/status/1729339652879110301)
- It works on any text web page as well as video — [Migaku: card creation from text](https://migaku.com/blog/youtube/card-creation-from-text-content-migaku-browser-extension); [Migaku FAQ goals](https://migaku.com/faq/goals)
- A 2026 review lists card contents as sentence, audio, optional screenshot, dictionary entry and custom fields — [wordy.info Migaku review 2026](https://wordy.info/blog/migaku-review)

**Language Reactor (Netflix/YouTube extension)**
- Core features: dual subtitles (original plus translation shown together), click-to-save words and phrases with context sentences, and links back to the moment in the video. Saved items are practised with SRS ("PhrasePump") — [LLN forum overview](https://forum.languagelearningwithnetflix.com/t/kamal-hinduja-swiss-what-is-language-reactor-and-how-does-it-work/33877); [JALT article](https://jalt-publications.org/articles/28605-enhancing-functionality-youtube-and-netflix-language-reactor)
- Export goes to CSV/TSV, which Anki can import. Sources disagree on the free tier: the older JALT piece says free users cannot save or export, while newer sources say basic saving is free and Anki export is Pro — [JALT](https://jalt-publications.org/articles/28605-enhancing-functionality-youtube-and-netflix-language-reactor); [stork.ai listing](https://www.stork.ai/en/language-reactor). Verify on the official site.
- The extension breaks when Netflix changes its UI, which is the maintenance cost of scraping streaming sites — [LLN forum](https://forum.languagelearningwithnetflix.com/t/kamal-hinduja-swiss-what-is-language-reactor-and-how-does-it-work/33877)

**Lingopie (curated streaming)**
- Player features: click a word to see its meaning and auto-save it to flashcards, dual subtitles, loop/repeat sentence, auto-pause at the end of each subtitle line, and a "speak"/repeat option for shadowing — [actualfluency review](https://actualfluency.com/lingopie-review); [teamjapanese review 2026](https://teamjapanese.com/lingopie-japanese-review/); [Lingopie blog](https://lingopie.com/blog/learn-languages-while-watching-netflix-with-lingopie)
- Speed control is reported inconsistently. FluentU says playback slows but cannot go above 1x, while Lingopie's blog says it can speed up too. Desktop reportedly has controls the mobile app lacks — [FluentU](https://fluentu.com/blog/reviews/lingopie); [ling-app review](https://ling-app.com/blog/lingopie-review/)
- User complaints: subtitles are not always accurate, and reviews feel repetitive — [langoly](https://langoly.com/lingopie-review); [FluentU review](https://www.fluentu.com/blog/reviews/lingopie-review/)

**Trancy**
- The only Trancy source I found is its own competitor-comparison blog post, which is promotional. It positions Trancy against Language Reactor on the same dual-subtitle and save-word model — [Trancy blog](https://www.trancy.org/blog/language-reactor-vs-trancy-complete-comparison-guide-3609d225200581e38e12da72010b2448)

**Toucan (Babbel), passive word replacement**
- It swaps a handful of words on any web page into the target language. Hovering a swapped word shows a card with the translation, native pronunciation and a save option — [hulry](https://hulry.com/toucan-learn-language/); [gHacks 2022, older](https://www.ghacks.net/2022/07/02/toucan-can-you-learn-a-language-while-browsing-the-web/)
- Users set the density (less to more) and their level. Free accounts were capped at medium density and Premium unlocked the highest — [Mapping Megan review](https://mappingmegan.com/free-browser-extension-learn-new-language-toucan-review/); [gHacks](https://www.ghacks.net/2022/07/02/toucan-can-you-learn-a-language-while-browsing-the-web/)
- Criticism: it replaces single words only, never phrases, and ignores context, so the translation can be wrong for the sense used — [lingoblend overview](https://www.lingoblend.app/blog/best-browser-extensions-for-language-learners); [gHacks](https://www.ghacks.net/2022/07/02/toucan-can-you-learn-a-language-while-browsing-the-web/)
- Babbel acquired Toucan in 2023 — [asumetech](https://asumetech.com/2023/09/19/babbel-acquires-toucan-expanding-language-learning-with-browser-extension-technology/)

**Kindle Word Wise and Vocabulary Builder**
- Word Wise (launched Dec 2014) shows simpler synonyms or short definitions above hard words in English Kindle books. A five-step difficulty slider controls how many hints appear — [Amazon JP announcement via ecnomikata](https://ecnomikata.com/pr/4105/). Turn it on under Settings > Reading Options > Language Learning — [FluentU IT](https://www.fluentu.com/blog/english-ita/kindle-inglese/)
- Vocabulary Builder stores looked-up words with their book context in a SQLite file, `system/vocabulary/vocab.db`, on the device. There is no official export. Users copy it over USB and convert it with community tools: kindle-export to CSV, FluentCards at fluentcards.com/kindle, or a direct SQL query on the `words` table — [nerdschalk](https://nerdschalk.com/how-to-extract-words-from-kindles-vocabulary-builder-to-pc/); [kindle-export npm](https://www.npmjs.com/package/kindle-export); [DEV: Kindle to Anki](https://dev.to/psamim/how-i-transfer-my-vocabs-from-my-kindle-paperwhite-to-anki-1f4d)

### Inferences

**Borrowable feature catalogue, grouped by area**

Audio:
- A "play sentence" button on every sentence, plus a word-level play button in the dictionary popup.
- Speed control at 0.5–1.5x. In TTS this is `utterance.rate` or the engine's length/speed setting.
- A loop-sentence toggle and auto-pause between sentences for shadowing, borrowed from Lingopie.
- "Listen while reading" with the current word or sentence highlighted. This needs timestamps from the TTS engine or from forced alignment.
- A record-yourself step that compares against the reference, as an optional extra.

Card design, using a Yomitan/asbplayer/Migaku-style field set:
- Word, lemma, reading (pinyin for zh, stress marks for ru, vowelled form for fa).
- Sentence and a cloze sentence, built Yomitan-style from prefix, body and suffix.
- Sentence translation.
- Definition.
- Word audio and sentence audio (TTS or recorded).
- An optional image.
- Source book or URL, and tags.
- The app's FSRS cards already hold sentences from your books. Adding sentence TTS audio and a cloze view would cover most of what these tools put on a card.

Anki bridge:
- (a) An AnkiConnect client running in the browser. It talks to `localhost:8765` and needs the app's origin added to `webCorsOriginList`, the same as asbplayer. It supports `addNote` with an audio URL that AnkiConnect downloads, and an "update last card" action.
- (b) A file export for phone users. CSV/TSV is what Language Reactor uses. An .apkg would be generated server-side and is not documented in these sources.
- (c) Check for duplicates on a unique first field.

Import:
- A PWA share target (GET for URL/text, POST for files), so that sharing a URL or text from a phone opens "import as book".
- A bookmarklet or minimal extension for desktop.
- Paste a list of words for bulk import, after Yomitan's note generation.
- An importer for Kindle `vocab.db`. It is already SQLite and includes a book-context sentence for each word, so it fits this stack.
- YouTube or SRT subtitles as reading text, ideally keeping timestamps for later audio sync.

Passive exposure:
- A Toucan-style "diglot" mode in Suggestions or imported native-language articles. It would swap known or learning target words into L1 text at a density the user picks.
- Kindle Word Wise-style glosses above unknown words, controlled by a density slider tied to word status. The app's word-status data makes this better than Word Wise, because hints can show only for status-unknown words. Ruby annotations could also show pinyin for zh.
- Phrase-level replacement using the app's multi-word terms would answer the main criticism of Toucan (single words only, no context).

### Gaps
- No primary Trancy documentation was retrieved, only its own promotional blog. Its AI features (sentence breakdown, shadowing) are not verified.
- I did not find Language Reactor's official 2026 pricing or tier pages. Free and Pro limits conflict across sources.
- I did not find whether Kindle Word Wise works for any non-English books, such as Chinese.
- Current Migaku extension feature list and supported languages for 2026: one third-party listing says only English, Spanish and Japanese, which conflicts with others. Unverified.
- I found no systematic user-feedback study (Reddit threads, etc.) on which card fields matter most. The field lists come from tool docs.
- Yomitan's audio-source configuration (Forvo, custom URL, local audio server) was not documented on the page I fetched.

## What free/open technologies make these feasible for a self-hosted app?

### Takeaway
Most of this is feasible today. The Web Speech API gives free TTS with no setup, but which voices you get depends on device and OS. Piper is the self-hostable CPU TTS that covers ru, zh, fa and sr. Kokoro covers zh, at low quality, and none of the other target languages. WhisperX has forced-alignment models for ru, zh, fa and hr. The PWA share target works on Chromium/Android only. YouTube transcript scraping is fragile from server IPs.

### Cited Findings

**Web Speech API (`speechSynthesis`)**
- `getVoices()` often returns an empty array at first in Chrome, Edge and Firefox. You listen for `voiceschanged` and call it again — [talkrapp: lessons learned](https://talkrapp.com/speechSynthesis.html); [Chrome dev blog](https://developer.chrome.com/blog/web-apps-that-talk-introduction-to-the-speech-synthesis-api)
- Chrome and Edge add cloud voices on top of the OS voices. Chrome desktop exposes Google voices such as "Google русский" and "Google 普通话（中国大陆）" — [talkrapp](https://talkrapp.com/speechSynthesis.html); [testmuai overview](https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/)
- On iOS, `getVoices()` lists more voices than you can actually select (55 listed, 36 usable, in an older post). iOS voices include Milena (ru) and Tian-Tian, Sin-Ji and Mei-Jia (zh) — [talkrapp](https://talkrapp.com/speechSynthesis.html)
- Android returns non-standard tags such as `ru_RU`. Chrome on Android mislabels some languages, and Edge on Android has returned empty voice lists. The voices come from the device's default TTS engine — [talkrapp](https://talkrapp.com/speechSynthesis.html); [web-speech-recommended-voices issues](https://github.com/HadrienGardeur/web-speech-recommended-voices/issues)
- The web-speech-recommended-voices project (Readium/EDRLab) curates recommended voices per language and platform and tracks quirks. It is a useful reference for picking a default voice — [GitHub issues](https://github.com/HadrienGardeur/web-speech-recommended-voices/issues)

**Piper (local neural TTS on CPU, ONNX)**
- Voices relevant here, all "medium" quality unless noted:
  - ru_RU: denis, dmitri, irina, ruslan
  - zh_CN: huayan (x_low and medium)
  - fa_IR: amir, ganji, ganji_adabi, gyro, reza_ibrahim
  - sr_RS: serbski_institut
  - Croatian and Bosnian: none

  — [rhasspy/piper VOICES.md](https://github.com/rhasspy/piper/blob/master/VOICES.md)
- The rhasspy/piper repository was archived on 6 Oct 2025 and is read-only. Development reportedly continues as OHF-Voice/piper1-gpl, but the fetched page does not confirm this, so verify it — [rhasspy/piper](https://github.com/rhasspy/piper/blob/master/VOICES.md)
- Some Piper voices have restrictive licenses, so check each voice's model card — [PravalX piper mirror](https://github.com/PravalX/piper_tts)

**Kokoro-82M**
- It has 54 voices in 9 languages: American English, British English, Mandarin (8 voices), Japanese, Hindi, Spanish, Brazilian Portuguese, Italian and French. It has no Russian, Persian or Serbo-Croatian — [Kokoro VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
- All 8 Mandarin voices are graded D overall (target quality C, trained on only minutes of data). The model card warns that non-English languages may be weak because of grapheme-to-phoneme processing and limited data — [Kokoro VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
- Third-party wrappers list German and Korean too, which conflicts with the official card. Treat that as unverified — [PyKokoro docs](https://pykokoro.readthedocs.io/); [Pipecat docs](https://docs.pipecat.ai/server/services/tts/kokoro)

**Microsoft neural voices through edge-tts (free, unofficial)**
- The open-source `edge-tts` library calls Microsoft's online Read Aloud TTS for free. Community voice lists include:
  - ru-RU: Dmitry, Svetlana
  - zh-CN: Xiaoxiao, Xiaoyi, Yunjian, Yunxi, Yunxia, Yunyang
  - fa-IR: Dilara, Farid
  - hr-HR: Gabrijela, Srecko
  - sr-RS: Nicholas, Sophie
  - bs-BA: Goran, Vesna

  — [FoloToy edge-tts voice list](https://github.com/FoloToy/folotoy-server-self-hosting/wiki/Edge%E2%80%90TTS%E2%80%90Voices); [MoneyPrinterTurbo voice-list](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/docs/voice-list.txt); [eimoon blog (zh)](https://blog.eimoon.com/p/tts-free-voice/)
- These are community snapshots, not official Microsoft documentation. `edge-tts --list-voices` confirms them. The service is an unofficial use of a Microsoft endpoint, so its terms and stability are uncertain. That is my inference, not sourced.

**Forced alignment and Whisper**
- WhisperX picks a language-specific wav2vec2 alignment model:
  - ru: jonatasgrosman/wav2vec2-large-xlsr-53-russian
  - zh: jonatasgrosman/...-chinese-zh-cn
  - fa: jonatasgrosman/...-persian
  - hr: classla/wav2vec2-xls-r-parlaspeech-hr
  - sr and bs: no default model

  — [whisperX alignment.py](https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py)
- Words with characters outside the alignment model's dictionary, such as numbers ("2014.") or currency, cannot be aligned and get no timing. A language with no alignment model cannot be aligned at all — [whisperX README](https://github.com/m-bain/whisperx)

**YouTube transcripts**
- youtube-transcript-api (Python): YouTube blocks most cloud-provider IP ranges (AWS, GCP, Azure), which gives `RequestBlocked` or `IpBlocked` errors. The README recommends rotating residential proxies. Static and datacenter proxies get banned, and even home IPs can be blocked after bursts — [PyPI README](https://pypi.org/project/youtube-transcript-api/); [issue #593 (2026)](https://github.com/jdepoix/youtube-transcript-api/issues/593); [issue #511](https://github.com/jdepoix/youtube-transcript-api/issues/511); [DEV guide](https://dev.to/bernardohsousa/why-youtube-transcript-api-gets-blocked-on-your-server-and-3-ways-to-fix-it-572m)

**PWA Web Share Target**
- In the manifest, `share_target` takes `action`, `method` (GET or POST), `enctype` and `params`, which map title, text, url and files. Files need POST with `multipart/form-data`. A service worker can intercept the POST, store the data, and redirect with 303. The app must be installed as a PWA first — [MDN share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target)
- MDN marks it "Limited availability", meaning not Baseline — [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target). That support is Chromium/Android only and missing on iOS Safari comes from general knowledge, not from the fetched page.

### Inferences
- **TTS architecture.** Use a tiered TTS provider:
  1. The browser's Web Speech API, the default and free.
  2. Server-side Piper for offline use, with cached MP3/OGG per sentence stored in SQLite or on disk.
  3. Optionally edge-tts or Azure for best quality, especially for bs, hr and fa.

  Cache the generated audio per sentence hash. Cached audio can then go on FSRS cards and be sent to Anki through AnkiConnect's audio URL.
- **Read-along sync.** Without real recordings, TTS engines that return word boundaries can drive highlighting:
  - The Web Speech API's `boundary` event.
  - Azure/edge-tts word boundary metadata (unverified here).

  WhisperX is only needed when the user brings their own audiobook or podcast audio. It covers ru, zh, fa and hr. For bs or sr, the hr alignment model would plausibly work on Latin-script text (untested).
- **YouTube import.** A self-hosted app on a home IP will mostly work at low volume. Fetching transcripts in the browser (client side), or having the user upload .srt/.vtt files, avoids the server-IP blocking problem.
- **iOS.** iOS users won't get a share target. Fallbacks are a bookmarklet, an iOS Shortcut that posts to the app's import URL, or paste-from-clipboard.

### Gaps
- No measured quality comparison (MOS) of Web Speech voices per language and platform. In particular I found nothing on whether Chrome, Android or iOS ship any fa or hr/bs/sr system voice.
- piper1-gpl (the successor repo) and any Piper voices added after Oct 2025 were not verified.
- Whether the Web Speech `boundary` event fires reliably for zh and fa on each platform was not researched.
- Per-language accuracy of Whisper ASR for bs, sr, fa and ru was not researched.
- Generating .apkg files (for example with genanki) was not researched with sources.

## What is the state of high-quality TTS for Farsi and Bosnian/Serbo-Croatian?

### Takeaway
Farsi has several open options: five Piper voices, MOSS-TTS-Nano-Persian, ParsVoice XTTS, and the CC0 ManaTTS dataset. None is clearly top-tier, and Microsoft's fa-IR neural voices (Dilara, Farid) are likely still the best freely reachable quality. Bosnian has no open self-hostable voice I could find. The practical options are Microsoft's bs-BA neural voices (Goran, Vesna) through Azure or edge-tts, the hr-HR/sr-RS Microsoft voices, or Piper's single Serbian voice. Piper sr_RS is presumably usable for Bosnian because the languages are mutually intelligible, but I found no source that tests this.

### Cited Findings
- **Piper fa_IR:** five medium voices (amir, ganji, ganji_adabi, gyro, reza_ibrahim) — [rhasspy/piper VOICES.md](https://github.com/rhasspy/piper/blob/master/VOICES.md). The pertts project builds a Persian TTS on the Piper "amir" voice. Described as lightweight, not high-fidelity — [pertts-streamlit](https://github.com/SadeghKrmi/pertts-streamlit)
- **ManaTTS:** a CC0 Persian TTS dataset and recipe. A model trained on it scored a MOS of 3.76, against 3.86 for natural spectrograms and 4.01 for natural speech — [ManaTTS paper, arXiv 2409.07259](https://arxiv.org/pdf/2409.07259)
- **MOSS-TTS-Nano-Persian:** a 117M-parameter fine-tune, Apache 2.0, trained on Common Voice Persian (CC0). Pitched for short utterances and small footprints — [Hugging Face model card](https://huggingface.co/nimaaaAI/MOSS-TTS-Nano-Persian)
- **ParsVoice XTTS-v2:** a Persian fine-tune of Coqui XTTS-v2, reported naturalness 3.6/5 and speaker similarity 4.0/5. Quality depends on the reference clip — [Hugging Face](https://huggingface.co/MohammadJRanjbar/ParsVoice-XTTS). License not verified. Coqui XTTS-v2's base license is generally non-commercial (general knowledge, unverified).
- **Pocket-TTS Farsi v2 / ParsiGo:** reportedly 973 hours from 2,978 speakers, CC-BY-NC-4.0 — [author LinkedIn post](https://www.linkedin.com/in/avoxm) (weak source)
- **Microsoft fa-IR:** DilaraNeural and FaridNeural are available through edge-tts and Azure — [FoloToy edge-tts list](https://github.com/FoloToy/folotoy-server-self-hosting/wiki/Edge%E2%80%90TTS%E2%80%90Voices)
- **Farsi text problem:** Farsi is normally written without short vowels. Kokoro's card warns that weak grapheme-to-phoneme processing hurts non-English quality — [Kokoro VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md). The same G2P issue applies to Farsi, but that is my inference, and no source tests it.
- **Bosnian, Azure/edge-tts:** Azure has bs-BA-VesnaNeural (female) and bs-BA-GoranNeural (male), with SSML support — [json2video Vesna](https://json2video.com/ai-voices/azure/voices/bs-ba-vesnaneural/); [json2video Goran](https://json2video.com/ai-voices/azure/voices/bs-ba-goranneural/). Both are in the edge-tts catalogue as "General" voices — [eimoon blog](https://blog.eimoon.com/p/tts-free-voice/)
- **Croatian and Serbian, Microsoft:** hr-HR Gabrijela and Srecko, and sr-RS Nicholas and Sophie — [FoloToy edge-tts list](https://github.com/FoloToy/folotoy-server-self-hosting/wiki/Edge%E2%80%90TTS%E2%80%90Voices). One medium Piper voice exists for sr_RS (serbski_institut). Piper has none for hr or bs — [rhasspy/piper VOICES.md](https://github.com/rhasspy/piper/blob/master/VOICES.md)
- **Other services:** SpeechGen.io (commercial) offers bs-BA voices, including Vesna and Goran — [speechgen.io](https://speechgen.io/en/tts-bosnian)
- **Kokoro:** no Persian, Serbian, Croatian or Bosnian — [Kokoro VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
- **Alignment:** WhisperX ships an hr alignment model (classla ParlaSpeech-HR). It has none for sr or bs — [whisperX alignment.py](https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py)

### Inferences
- **Recommended per-language TTS defaults for this app:**
  - ru: Web Speech, or Piper (4 voices).
  - zh: Web Speech (Google/Apple voices are good), with Piper huayan as fallback. Kokoro zh is graded D.
  - fa: edge-tts/Azure Dilara or Farid for quality, with Piper fa_IR offline.
  - bs: edge-tts/Azure Goran or Vesna. hr-HR is an alternative, and Piper sr_RS is the offline fallback, if Bosnian text is in Latin script and the Serbian voice reads it acceptably.
- **Caching.** Pre-generating and caching sentence audio on the server keeps dependence on any online service to one call per sentence.
- **Farsi homographs.** The AI tutor (Claude) could add vowel marks to Farsi sentences before TTS. That could reduce mispronunciation of homographs, but it is untested.

### Gaps
- I found no independent 2026 listening comparison of Farsi TTS options, open versus Microsoft or Google.
- Whether Google Cloud TTS or Android's Google TTS engine offers Bosnian, Croatian or Persian voices is not confirmed. No source was found.
- I could not confirm whether any device ships Bosnian or Persian voices on iOS or macOS.
- I did not find any open Bosnian TTS model or dataset on Hugging Face, though one may exist (for example CLASSLA/ReLDI resources for South Slavic). Not searched in depth.
- Licensing and terms-of-service status of using edge-tts in a self-hosted app is not documented in the sources found.
