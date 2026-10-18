import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { styles } from '@/src/styles';
import { useLanguage } from '@/src/i18n';

export default function NotFound() {
  const router = useRouter();
  const { t } = useLanguage();
  return <SafeAreaView style={styles.page}><View style={styles.shell}>
    <Text accessibilityRole="alert" style={styles.title}>{t('route.notFound')}</Text>
    <Text style={styles.subtitle}>{t('route.unknown')}</Text>
    <Pressable onPress={() => router.push('/home')} style={styles.button}><Text style={styles.buttonText}>{t('nav.home')}</Text></Pressable>
    <Pressable onPress={() => router.push('/game-nights')} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t('nav.nights')}</Text></Pressable>
  </View></SafeAreaView>;
}
