import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export type Language = 'en' | 'tr';
export const supportedLanguages: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
];

type TranslationKey = keyof typeof translations.en;
type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;
const translations = {
  en: {
    'language.english': 'English', 'language.turkish': 'Türkçe',
    'login.eyebrow': 'TROY BOTC · PRIVATE COMMUNITY', 'login.title': 'Gather. Play.\nRemember.',
    'login.subtitle': 'Your calm home for game nights, trusted RSVPs, and the stories you bring back to the table.',
    'login.email': 'Email address', 'login.password': 'Password', 'login.passwordPlaceholder': 'Enter your password', 'login.signIn': 'Sign in', 'common.working': 'Working…',
    'login.or': 'OR', 'login.google': 'Continue with Google',
    'login.missingCredentials': 'Enter your email and password.', 'login.invalidCredentials': 'The email or password is incorrect.', 'login.signInError': 'Sign-in failed. Please try again.',
    'login.googleCancelled': 'Google sign-in was cancelled.', 'login.googleError': 'Google sign-in failed. Check that Google is enabled and localhost is an authorized domain.',
    'nav.home': 'Home', 'nav.nights': 'Game nights', 'nav.leaderboard': 'Leaderboard', 'nav.profile': 'Profile', 'nav.online': '● Online', 'nav.logout': 'Log out',
    'home.greeting': 'GOOD EVENING, {name}', 'home.title': 'Your next story', 'home.rank': 'PARTICIPATION RANK',
    'home.attended': '{count} attended', 'home.until': '{count} until {rank}', 'home.topRank': 'top rank reached',
    'home.upcoming': 'Upcoming tables', 'common.seeAll': 'See all', 'home.findTable': 'FIND YOUR TABLE',
    'night.full': 'Full table', 'night.places': '{count} places left', 'night.players': '{count} / {capacity} players',
    'night.details': 'View details →', 'night.cancel': 'Cancel RSVP', 'night.join': 'Join game night', 'night.fullButton': 'Table is full',
    'home.community': 'THE COMMUNITY', 'leaderboard.subtitle': 'Ranked by nights attended, never by skill.', 'leaderboard.unavailable': 'Leaderboard unavailable.',
    'profile.identity': 'YOUR IDENTITY', 'profile.progress': 'Your progress', 'profile.attendedNights': '{count} game nights attended',
    'profile.master': 'Master storyteller', 'error.expired': 'Your session has expired', 'error.signIn': 'Sign in again to continue.',
    'error.load': 'The table could not be loaded', 'error.try': 'Please try again.', 'error.login': 'Return to login', 'error.retry': 'Try again',
  },
  tr: {
    'language.english': 'English', 'language.turkish': 'Türkçe',
    'login.eyebrow': 'TROY BOTC · ÖZEL TOPLULUK', 'login.title': 'Buluş. Oyna.\nHatırla.',
    'login.subtitle': 'Oyun geceleri, güvenilir katılım bildirimleri ve masaya taşıdığın hikâyeler için sakin yuvan.',
    'login.email': 'E-posta adresi', 'login.password': 'Şifre', 'login.passwordPlaceholder': 'Şifreni gir', 'login.signIn': 'Giriş yap', 'common.working': 'Çalışıyor…',
    'login.or': 'VEYA', 'login.google': 'Google ile devam et',
    'login.missingCredentials': 'E-posta ve şifreni gir.', 'login.invalidCredentials': 'E-posta veya şifre hatalı.', 'login.signInError': 'Giriş başarısız. Lütfen tekrar dene.',
    'login.googleCancelled': 'Google girişi iptal edildi.', 'login.googleError': 'Google girişi başarısız. Google’ın etkin ve localhost’un yetkili alan adı olduğunu kontrol et.',
    'nav.home': 'Ana sayfa', 'nav.nights': 'Oyun geceleri', 'nav.leaderboard': 'Liderlik tablosu', 'nav.profile': 'Profil', 'nav.online': '● Çevrimiçi', 'nav.logout': 'Çıkış yap',
    'home.greeting': 'İYİ AKŞAMLAR, {name}', 'home.title': 'Sıradaki hikâyen', 'home.rank': 'KATILIM RÜTBESİ',
    'home.attended': '{count} katılım', 'home.until': '{rank} için {count} kaldı', 'home.topRank': 'en üst rütbedesin',
    'home.upcoming': 'Yaklaşan masalar', 'common.seeAll': 'Tümünü gör', 'home.findTable': 'MASANI BUL',
    'night.full': 'Masa dolu', 'night.places': '{count} yer kaldı', 'night.players': '{count} / {capacity} oyuncu',
    'night.details': 'Detayları gör →', 'night.cancel': 'Katılımı iptal et', 'night.join': 'Oyun gecesine katıl', 'night.fullButton': 'Masa dolu',
    'home.community': 'TOPLULUK', 'leaderboard.subtitle': 'Yetenekle değil, katılınan gecelerle sıralanır.', 'leaderboard.unavailable': 'Liderlik tablosu kullanılamıyor.',
    'profile.identity': 'KİMLİĞİN', 'profile.progress': 'İlerlemen', 'profile.attendedNights': '{count} oyun gecesine katıldın',
    'profile.master': 'Usta hikâye anlatıcısı', 'error.expired': 'Oturumunun süresi doldu', 'error.signIn': 'Devam etmek için tekrar giriş yap.',
    'error.load': 'Masa yüklenemedi', 'error.try': 'Lütfen tekrar dene.', 'error.login': 'Girişe dön', 'error.retry': 'Tekrar dene',
  },
} satisfies Record<Language, Record<string, string>>;

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: Translator }>({
  language: 'en', setLanguage: () => undefined, t: (key) => translations.en[key],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    return window.localStorage.getItem('troy-botc-language') === 'tr' ? 'tr' : 'en';
  });
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') window.localStorage.setItem('troy-botc-language', next);
  };
  const t: Translator = (key, values) => (values ? Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), translations[language][key]) : translations[language][key]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <View style={{ flexDirection: 'row', gap: 6 }}>
    {supportedLanguages.map(({ code, label }) => <Pressable key={code} onPress={() => setLanguage(code)} style={{ borderWidth: 1, borderColor: '#e5e9e2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: code === language ? '#dff0e5' : '#fffefa' }}><Text style={{ color: '#1e5a43', fontWeight: '700' }}>{label}</Text></Pressable>)}
  </View>;
}
