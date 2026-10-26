import { pinyin } from 'pinyin-pro';
import type { Language } from './languages';

/** A Pronunciation to fill in for a new Term: pinyin for Chinese, nothing otherwise. */
export function suggestPronunciation(text: string, language: Pick<Language, 'code'>): string {
	return language.code === 'zh' ? pinyin(text, { separator: '' }) : '';
}
