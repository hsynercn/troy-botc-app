import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/src/i18n';
const client = new QueryClient();
export default function Layout() { return <LanguageProvider><QueryClientProvider client={client}><Stack screenOptions={{ headerShown: false }} /></QueryClientProvider></LanguageProvider>; }
