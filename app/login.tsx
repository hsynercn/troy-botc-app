import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, styles } from '@/src/styles';
import { LanguageSwitcher, useLanguage } from '@/src/i18n';
import { auth, googleProvider, signInWithEmailAndPassword, signInWithPopup } from '@/src/firebase';
import { useAuthSession } from '@/src/auth-session';
import { safeDestination } from '@/src/routing';

export default function SignIn() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	const [signedIn, setSignedIn] = useState(false);
	const router = useRouter();
	const { returnTo, reauthenticate } = useLocalSearchParams();
	const destination = safeDestination(returnTo);
	const needsSignIn = reauthenticate === 'true' && !signedIn;
	const { ready, user, signingOut } = useAuthSession();
	const { t } = useLanguage();
	const { width } = useWindowDimensions();
	const compact = width < 560;

	useEffect(() => {
		if (ready && !needsSignIn && !signingOut && (user || process.env.EXPO_PUBLIC_DEMO_MODE === 'true')) router.replace(destination ?? '/home');
	}, [ready, user, needsSignIn, signingOut, destination, router]);

	const signInWithEmail = async () => {
		if (!email.trim() || !password) { setMessage(t('login.missingCredentials')); return; }
		setBusy(true);
		setMessage('');
		try {
			await signInWithEmailAndPassword(auth, email.trim(), password);
			setSignedIn(true);
		} catch (error) {
			const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : '';
			setMessage(code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password'
				? t('login.invalidCredentials') : t('login.signInError'));
		} finally { setBusy(false); }
	};
	const signInWithGoogle = async () => {
		setBusy(true);
		setMessage('');
		try {
			await signInWithPopup(auth, googleProvider);
			setSignedIn(true);
		} catch (error) {
			const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : '';
			setMessage(code === 'auth/popup-closed-by-user' ? t('login.googleCancelled') : t('login.googleError'));
		} finally { setBusy(false); }
	};
	if (!ready || (!needsSignIn && !signingOut && (user || process.env.EXPO_PUBLIC_DEMO_MODE === 'true'))) return <SafeAreaView style={styles.page}><ActivityIndicator color={colors.green} /></SafeAreaView>;
	return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"><View style={[styles.shell, { flex: 1, justifyContent: compact ? 'flex-start' : 'center', maxWidth: 560, paddingHorizontal: compact ? 18 : 28, paddingVertical: compact ? 18 : 24 }]}>
		<View style={{ alignItems: 'flex-end', marginBottom: 20 }}><LanguageSwitcher /></View>
		<Text style={styles.eyebrow}>{t('login.eyebrow')}</Text>
		<Text style={[styles.title, { marginTop: 12, fontSize: compact ? 38 : 48 }]}>{t('login.title')}</Text>
		<Text style={[styles.subtitle, { marginTop: 18, marginBottom: 28 }]}>{t('login.subtitle')}</Text>
		{destination ? <Text accessibilityRole="alert" style={[styles.subtitle, { marginBottom: 16 }]}>{t('route.loginRequired')}</Text> : null}
		<Text style={{ color: colors.ink, fontWeight: '700', marginBottom: 8 }}>{t('login.email')}</Text>
		<TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 12 }} />
		<Text style={{ color: colors.ink, fontWeight: '700', marginBottom: 8 }}>{t('login.password')}</Text>
		<TextInput value={password} onChangeText={setPassword} placeholder={t('login.passwordPlaceholder')} placeholderTextColor={colors.muted} autoCapitalize="none" secureTextEntry style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 12 }} />
		<Pressable disabled={busy} onPress={signInWithEmail} style={styles.button}><Text style={styles.buttonText}>{busy ? t('common.working') : t('login.signIn')}</Text></Pressable>
		<View style={[styles.row, { marginVertical: 20 }]}><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text style={{ color: colors.muted, marginHorizontal: 12, fontSize: 12 }}>{t('login.or')}</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /></View>
		<Pressable disabled={busy} onPress={signInWithGoogle} style={[styles.button, styles.secondaryButton, { borderWidth: 1, borderColor: colors.line }]}><Text style={[styles.buttonText, styles.secondaryText]}>{busy ? t('common.working') : t('login.google')}</Text></Pressable>
		{message ? <Text style={{ color: colors.red, marginTop: 14, lineHeight: 20 }}>{message}</Text> : null}
	</View></ScrollView></SafeAreaView>;
}