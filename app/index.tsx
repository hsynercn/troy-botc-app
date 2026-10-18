import { Redirect } from 'expo-router';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuthSession } from '@/src/auth-session';
import { DEMO_MODE } from '@/src/api';
import { colors, styles } from '@/src/styles';

export default function Index() {
  const { ready, user, signingOut } = useAuthSession();
  if (!ready) return <SafeAreaView style={styles.page}><ActivityIndicator color={colors.green} /></SafeAreaView>;
  return <Redirect href={!signingOut && (user || DEMO_MODE) ? '/home' : '/login'} />;
}
