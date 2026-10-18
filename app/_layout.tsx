import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/src/i18n';
import { AuthSessionProvider } from '@/src/auth-session';
import { useEffect } from 'react';
import { installWebNavigationGuard } from '@/src/navigation';
const client = new QueryClient();
export default function Layout() {
  useEffect(installWebNavigationGuard, []);
  return <LanguageProvider><QueryClientProvider client={client}><AuthSessionProvider><Stack screenOptions={{ headerShown: false }} /></AuthSessionProvider></QueryClientProvider></LanguageProvider>;
}
