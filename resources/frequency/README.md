# Frequency lists

The 20,000 most frequent words per Language, one per line, most frequent first. They give each Word its Frequency band (see `CONTEXT.md`).

From [FrequencyWords](https://github.com/hermitdave/FrequencyWords) by Hermit Dave, 2018 lists built from [OpenSubtitles 2018](http://opus.nlpl.eu/OpenSubtitles2018.php), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Trimmed to the first 20,000 lines with the counts removed; `zh.txt` is their `zh_cn` list.

The Reader loads a Language's list into the database the first time it needs it, keyed by Normalised form; entries without a letter (punctuation) are skipped.
