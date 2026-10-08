export type Locale = 'en' | 'vi'

export function localize(locale: Locale, english: string, vietnamese: string): string {
  return locale === 'vi' ? vietnamese : english
}