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
    'route.notFound': 'Page not found', 'route.unknown': 'This address does not match an app page.',
    'route.missing': 'Game night not found', 'route.denied': 'Access denied',
    'route.loginRequired': 'Sign in to continue to the page you requested.',
    'route.logoutFailed': 'Sign out failed. Please try again.',
    'language.english': 'English', 'language.turkish': 'Türkçe',
    'login.eyebrow': 'TROY BOTC · PRIVATE COMMUNITY', 'login.title': 'Gather. Play.\nRemember.',
    'login.subtitle': 'Your calm home for game sessions, registrations, and the stories you bring back to the table.',
    'login.email': 'Email address', 'login.password': 'Password', 'login.passwordPlaceholder': 'Enter your password', 'login.signIn': 'Sign in', 'common.working': 'Working…',
    'login.or': 'OR', 'login.google': 'Continue with Google',
    'login.missingCredentials': 'Enter your email and password.', 'login.invalidCredentials': 'The email or password is incorrect.', 'login.signInError': 'Sign-in failed. Please try again.',
    'login.googleCancelled': 'Google sign-in was cancelled.', 'login.googleError': 'Google sign-in failed. Check that Google is enabled and localhost is an authorized domain.',
    'nav.home': 'Home', 'nav.nights': 'Game nights', 'nav.leaderboard': 'Leaderboard', 'nav.profile': 'Profile', 'nav.online': '● Online', 'nav.logout': 'Log out',
    'home.greeting': 'GOOD EVENING, {name}', 'home.title': 'Your next story', 'home.rank': 'PARTICIPATION RANK',
    'home.attended': '{count} attended', 'home.until': '{count} until {rank}', 'home.topRank': 'top rank reached',
    'home.upcoming': 'Upcoming tables', 'common.seeAll': 'See all', 'home.findTable': 'FIND YOUR TABLE',
    'night.full': 'Full table', 'night.places': '{count} places left', 'night.players': '{count} / {capacity} players',
    'night.details': 'View details →', 'night.back': 'Back to game nights', 'night.edit': 'Edit session details', 'night.save': 'Save session', 'night.publish': 'Publish session', 'night.participants': 'Participants', 'night.remove': 'Remove', 'night.cancel': 'Remove registration', 'night.join': 'Register for session', 'night.fullButton': 'Table is full', 'registration.manage': 'Manage registrations', 'registration.search': 'Search community users', 'registration.add': 'Register selected users',
    'night.noParticipants': 'No participants registered yet.', 'registration.registered': 'Already registered',
    'attendance.manage': 'Record attendance', 'attendance.correct': 'Correct attendance', 'attendance.help': 'Choose whether each participant attended or was a no-show.', 'attendance.emptyRoster': 'There are no eligible participants. You can still complete this game night.',
    'attendance.attended': 'Attended', 'attendance.noShow': 'No-show', 'attendance.complete': 'Complete session', 'attendance.saveCorrections': 'Save corrections',
    'night.create': 'Create session', 'night.createDraft': 'Create draft', 'common.cancel': 'Cancel',
    'night.draftHelp': 'New sessions are private drafts, visible only to you and admins until published.',
    'night.title': 'Session title', 'night.startsAt': 'Start time', 'night.endsAt': 'End time (optional)',
    'night.timeHelp': 'Use a timezone-aware time, e.g. 2026-10-17T19:00:00+03:00.',
    'night.venueName': 'Venue name', 'night.venueAddress': 'Venue address (optional)', 'night.capacity': 'Capacity (1–500)', 'night.notes': 'Notes (optional)',
    'night.invalidDetails': 'Enter a title (up to 120 characters) and a venue name (up to 200 characters).',
    'night.invalidTimes': 'Enter valid timezone-aware times. The end must be after the start.',
    'night.invalidCapacity': 'Capacity must be a whole number between 1 and 500.', 'night.empty': 'No game sessions yet.',
    'night.cannotClearEnd': 'An existing end time cannot be removed. Enter a replacement time.',
    'home.community': 'THE COMMUNITY', 'leaderboard.subtitle': 'Ranked by nights attended, never by skill.', 'leaderboard.unavailable': 'Leaderboard unavailable.',
    'profile.identity': 'YOUR IDENTITY', 'profile.progress': 'Your progress', 'profile.attendedNights': '{count} game nights attended',
    'profile.master': 'Master storyteller', 'error.expired': 'Your session has expired', 'error.signIn': 'Sign in again to continue.',
    'error.load': 'The table could not be loaded', 'error.try': 'Please try again.', 'error.login': 'Return to login', 'error.retry': 'Try again',
  },
  tr: {
    'route.notFound': 'Sayfa bulunamadı', 'route.unknown': 'Bu adres bir uygulama sayfasıyla eşleşmiyor.',
    'route.missing': 'Oyun gecesi bulunamadı', 'route.denied': 'Erişim reddedildi',
    'route.loginRequired': 'İstediğiniz sayfaya devam etmek için giriş yapın.',
    'route.logoutFailed': 'Çıkış yapılamadı. Lütfen tekrar deneyin.',
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
    'night.details': 'Detayları gör →', 'night.back': 'Oyun gecelerine dön', 'night.edit': 'Oturum detaylarını düzenle', 'night.save': 'Oturumu kaydet', 'night.publish': 'Oturumu yayınla', 'night.participants': 'Katılımcılar', 'night.remove': 'Kaldır', 'night.cancel': 'Kaydı kaldır', 'night.join': 'Oyun oturumuna kaydol', 'night.fullButton': 'Masa dolu', 'registration.manage': 'Kayıtları yönet', 'registration.search': 'Topluluk kullanıcılarını ara', 'registration.add': 'Seçilen kullanıcıları kaydet',
    'night.noParticipants': 'Henüz kayıtlı katılımcı yok.', 'registration.registered': 'Zaten kayıtlı',
    'attendance.manage': 'Katılımı kaydet', 'attendance.correct': 'Katılımı düzelt', 'attendance.help': 'Her katılımcının katıldığını veya gelmediğini seç.', 'attendance.emptyRoster': 'Katılmaya uygun kimse yok. Yine de bu oyun gecesini tamamlayabilirsin.',
    'attendance.attended': 'Katıldı', 'attendance.noShow': 'Gelmedi', 'attendance.complete': 'Oturumu tamamla', 'attendance.saveCorrections': 'Düzeltmeleri kaydet',
    'night.create': 'Oturum oluştur', 'night.createDraft': 'Taslak oluştur', 'common.cancel': 'Vazgeç',
    'night.draftHelp': 'Yeni oturumlar yayınlanana kadar yalnızca sana ve yöneticilere görünen özel taslaklardır.',
    'night.title': 'Oturum başlığı', 'night.startsAt': 'Başlangıç zamanı', 'night.endsAt': 'Bitiş zamanı (isteğe bağlı)',
    'night.timeHelp': 'Saat dilimi içeren bir zaman gir, ör. 2026-10-17T19:00:00+03:00.',
    'night.venueName': 'Mekân adı', 'night.venueAddress': 'Mekân adresi (isteğe bağlı)', 'night.capacity': 'Kapasite (1–500)', 'night.notes': 'Notlar (isteğe bağlı)',
    'night.invalidDetails': 'Başlık (en fazla 120 karakter) ve mekân adı (en fazla 200 karakter) gir.',
    'night.invalidTimes': 'Saat dilimi içeren geçerli zamanlar gir. Bitiş, başlangıçtan sonra olmalıdır.',
    'night.invalidCapacity': 'Kapasite 1 ile 500 arasında bir tam sayı olmalıdır.', 'night.empty': 'Henüz oyun oturumu yok.',
    'night.cannotClearEnd': 'Mevcut bitiş zamanı kaldırılamaz. Yeni bir bitiş zamanı gir.',
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
