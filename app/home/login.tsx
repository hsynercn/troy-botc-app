import { Redirect, useLocalSearchParams } from 'expo-router';
import { loginDestination } from '@/src/routing';

// Legacy nested login links remain valid; only canonical product returns survive.
export default function LegacyLogin() {
  const { returnTo, reauthenticate } = useLocalSearchParams();
  return <Redirect href={loginDestination(returnTo, reauthenticate === 'true')} />;
}
