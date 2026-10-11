import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api';
import { auth, onAuthStateChanged, signOut } from '@/src/firebase';
import type { AttendanceStatus, GameNight, Player } from '@/src/types';
import { colors, styles } from '@/src/styles';
import { LanguageSwitcher, useLanguage } from '@/src/i18n';

const dateLabel = (date: string, language: string) => new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
function Badge({ children, tone = 'green' }: { children: string; tone?: 'green' | 'gold' | 'red' }) { return <View style={{ backgroundColor: tone === 'green' ? colors.mint : tone === 'gold' ? '#f8ecd5' : '#f7dfdc', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: tone === 'green' ? colors.green : tone === 'gold' ? '#8b5a12' : colors.red, fontWeight: '800', fontSize: 11 }}>{children}</Text></View>; }
function NightCard({ night, onRefresh, onDetails }: { night: GameNight; onRefresh: () => void; onDetails?: () => void }) {
	const { language, t } = useLanguage();
	const { width } = useWindowDimensions();
	const compact = width < 560;
	const full = night.participantCount >= night.capacity;
	return <View style={[styles.card, { marginBottom: 14, padding: compact ? 16 : 20 }]}><View style={styles.between}><View style={{ flex: 1, paddingRight: 12 }}><Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>{night.title}</Text><Text style={[styles.subtitle, { marginTop: 5 }]}>{dateLabel(night.startsAt, language)}</Text></View><Badge tone={night.status === 'PUBLISHED' ? 'green' : 'gold'}>{night.status}</Badge></View><View style={{ marginTop: 18, gap: 8 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>⌖ {night.venueName}</Text><Text style={{ color: colors.muted }}>♟ {t('night.players', { count: night.participantCount, capacity: night.capacity })} · {full ? t('night.full') : t('night.places', { count: night.capacity - night.participantCount })}</Text>{night.notes ? <Text style={{ color: colors.muted, lineHeight: 21 }}>{night.notes}</Text> : null}</View><Pressable onPress={onDetails} disabled={!onDetails} accessibilityRole="button" style={{ marginTop: 18 }}><Text style={{ color: colors.green, fontWeight: '800' }}>{t('night.details')}</Text></Pressable></View>;
}
function RegistrationManager({ night, onRefresh }: { night: GameNight; onRefresh: () => Promise<unknown> }) {
	const { t } = useLanguage();
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<string[]>([]);
	const users = useQuery({ queryKey: ['users', query], queryFn: () => api.searchUsers(query) });
	const roster = useQuery({ queryKey: ['roster', night.id], queryFn: () => api.roster(night.id) });
	const registered = new Set(roster.data?.map((participant) => participant.playerId));
	const playerIds = selected.filter((id) => !registered.has(id));
	const mutation = useMutation({ mutationFn: () => api.register(night.id, playerIds), onSuccess: async () => { await onRefresh(); setSelected([]); }, onError: onRefresh });
	const disabled = !playerIds.length || mutation.isPending || roster.isPending || roster.isError;
	return <View style={[styles.card, { marginBottom: 14 }]}>
		<Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>{t('registration.manage')}</Text>
		<TextInput value={query} onChangeText={setQuery} placeholder={t('registration.search')} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, marginTop: 12 }} />
		{users.isPending ? <ActivityIndicator color={colors.green} style={{ marginTop: 12 }} /> : null}
		{users.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 10 }}>{users.error.message}</Text> : null}
		{users.data?.map((user) => {
			const alreadyRegistered = registered.has(user.id);
			return <Pressable key={user.id} disabled={alreadyRegistered || mutation.isPending || roster.isPending || roster.isError} onPress={() => setSelected((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} accessibilityRole="checkbox" accessibilityState={{ checked: alreadyRegistered || selected.includes(user.id), disabled: alreadyRegistered || mutation.isPending || roster.isPending || roster.isError }} style={[styles.between, { paddingVertical: 10 }]}>
				<Text style={{ color: colors.ink }}>{user.displayName}</Text>
				<Text style={{ color: alreadyRegistered ? colors.muted : selected.includes(user.id) ? colors.green : colors.muted, fontWeight: '800' }}>{alreadyRegistered ? t('registration.registered') : selected.includes(user.id) ? '✓' : '+'}</Text>
			</Pressable>;
		})}
		{mutation.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 10 }}>{mutation.error.message}</Text> : null}
		<Pressable disabled={disabled} onPress={() => mutation.mutate()} style={[styles.button, { marginTop: 8 }, disabled && { opacity: 0.5 }]}><Text style={styles.buttonText}>{mutation.isPending ? t('common.working') : t('registration.add')}</Text></Pressable>
	</View>;
}
function SessionEditor({ night, onSaved }: { night: GameNight; onSaved: (night: GameNight) => void }) {
	const { t } = useLanguage();
	const [form, setForm] = useState({ title: night.title, startsAt: night.startsAt, endsAt: night.endsAt ?? '', venueName: night.venueName, venueAddress: night.venueAddress ?? '', notes: night.notes ?? '', capacity: String(night.capacity) });
	const mutation = useMutation({ mutationFn: () => {
		if (night.endsAt && !form.endsAt.trim()) throw new Error(t('night.cannotClearEnd'));
		return api.updateNight(night.id, { ...form, endsAt: form.endsAt.trim() || null, capacity: Number(form.capacity) });
	}, onSuccess: onSaved });
	const field = (key: keyof typeof form, placeholder: string, multiline = false) => <TextInput value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} placeholder={placeholder} multiline={multiline} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 11, marginTop: 10, minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? 'top' : 'center' }} />;
	return <View style={[styles.card, { marginTop: 14 }]}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>{t('night.edit')}</Text>{field('title', 'Session title')}{field('startsAt', 'Start time (ISO, e.g. 2026-10-17T16:00:00Z)')}{field('endsAt', 'End time (ISO)')}{field('venueName', 'Venue name')}{field('venueAddress', 'Venue address')}{field('capacity', 'Capacity')}{field('notes', 'Notes', true)}{mutation.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 10 }}>{mutation.error.message}</Text> : null}<Pressable disabled={mutation.isPending} onPress={() => mutation.mutate()} style={[styles.button, { marginTop: 12 }, mutation.isPending && { opacity: 0.6 }]}><Text style={styles.buttonText}>{mutation.isPending ? t('common.working') : t('night.save')}</Text></Pressable></View>;
}
function SessionCreator({ onCreated, onCancel }: { onCreated: (night: GameNight) => Promise<void>; onCancel: () => void }) {
	const { t } = useLanguage();
	const [form, setForm] = useState(() => {
		const start = new Date();
		const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
		return { title: '', startsAt: start.toISOString(), endsAt: end.toISOString(), venueName: '', venueAddress: '', notes: '', capacity: '15' };
	});
	const mutation = useMutation({
		mutationFn: () => {
			const title = form.title.trim();
			const venueName = form.venueName.trim();
			const startsAt = form.startsAt.trim();
			const endsAt = form.endsAt.trim();
			const capacity = Number(form.capacity);
			const validTime = (value: string) => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === value.slice(0, 10);
			if (!title || title.length > 120 || !venueName || venueName.length > 200) throw new Error(t('night.invalidDetails'));
			if (!validTime(startsAt) || (endsAt && (!validTime(endsAt) || Date.parse(endsAt) <= Date.parse(startsAt)))) throw new Error(t('night.invalidTimes'));
			if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) throw new Error(t('night.invalidCapacity'));
			return api.createNight({ title, startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null, venueName, venueAddress: form.venueAddress.trim() || null, notes: form.notes.trim() || null, capacity });
		},
		onSuccess: onCreated,
	});
	const field = (key: keyof typeof form, label: string, multiline = false) => <View key={key} style={{ marginTop: 12 }}>
		<Text style={{ color: colors.ink, fontWeight: '700' }}>{label}</Text>
		<TextInput accessibilityLabel={label} value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} editable={!mutation.isPending} keyboardType={key === 'capacity' ? 'number-pad' : 'default'} autoCapitalize="none" multiline={multiline} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 11, marginTop: 6, minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? 'top' : 'center' }} />
	</View>;
	return <View style={[styles.card, { marginBottom: 14 }]}>
		<Text style={{ color: colors.ink, fontWeight: '800', fontSize: 20 }}>{t('night.create')}</Text>
		<Text style={[styles.subtitle, { marginTop: 8 }]}>{t('night.draftHelp')}</Text>
		{field('title', t('night.title'))}{field('startsAt', t('night.startsAt'))}{field('endsAt', t('night.endsAt'))}
		<Text style={[styles.subtitle, { marginTop: 6 }]}>{t('night.timeHelp')}</Text>
		{field('venueName', t('night.venueName'))}{field('venueAddress', t('night.venueAddress'))}{field('capacity', t('night.capacity'))}{field('notes', t('night.notes'), true)}
		{mutation.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 12 }}>{mutation.error.message}</Text> : null}
		<Pressable accessibilityRole="button" disabled={mutation.isPending} onPress={() => mutation.mutate()} style={[styles.button, { marginTop: 16 }, mutation.isPending && { opacity: 0.6 }]}><Text style={styles.buttonText}>{mutation.isPending ? t('common.working') : t('night.createDraft')}</Text></Pressable>
		<Pressable accessibilityRole="button" disabled={mutation.isPending} onPress={onCancel} style={{ marginTop: 14, padding: 8, alignItems: 'center' }}><Text style={{ color: colors.green, fontWeight: '800' }}>{t('common.cancel')}</Text></Pressable>
	</View>;
}
function ParticipantManager({ night, canManage, onRefresh }: { night: GameNight; canManage: boolean; onRefresh: () => Promise<unknown> }) {
	const { t } = useLanguage();
	const roster = useQuery({ queryKey: ['roster', night.id], queryFn: () => api.roster(night.id) });
	const remove = useMutation({ mutationFn: (playerId: string) => api.removeRegistration(night.id, playerId), onSuccess: onRefresh, onError: onRefresh });
	if (roster.isError) return <ErrorState error={roster.error} />;
	return <View style={[styles.card, { marginTop: 14 }]}>
		<Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>{t('night.participants')}</Text>
		{roster.isLoading ? <ActivityIndicator color={colors.green} style={{ marginTop: 12 }} /> : roster.data?.length ? roster.data.map((participant) => <View key={participant.playerId} style={[styles.between, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }]}>
			<View><Text style={{ color: colors.ink, fontWeight: '700' }}>{participant.displayName}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{participant.status}</Text></View>
			{canManage && (participant.status === 'REGISTERED' || participant.status === 'RSVPED') ? <Pressable onPress={() => remove.mutate(participant.playerId)} disabled={remove.isPending} hitSlop={8}><Text style={{ color: colors.red, fontWeight: '800' }}>{t('night.remove')}</Text></Pressable> : null}
		</View>) : <Text style={[styles.subtitle, { marginTop: 10 }]}>{t('night.noParticipants')}</Text>}
		{remove.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 10 }}>{remove.error.message}</Text> : null}
	</View>;
}
function AttendanceManager({ night, actor, onRefresh }: { night: GameNight; actor: Player; onRefresh: () => Promise<unknown> }) {
	const { t } = useLanguage();
	const roster = useQuery({ queryKey: ['roster', night.id], queryFn: () => api.roster(night.id) });
	const [selected, setSelected] = useState<Record<string, AttendanceStatus>>({});
	const isAdmin = actor.role === 'ADMIN';
	const canComplete = night.status === 'PUBLISHED'
		&& (isAdmin || (actor.role === 'ORGANIZER' && night.createdBy === actor.id));
	const canCorrect = night.status === 'COMPLETED' && isAdmin;
	const eligible = (roster.data ?? []).filter((participant) => participant.status !== 'CANCELLED');
	const statusFor = (playerId: string, status: string): AttendanceStatus | undefined =>
		selected[playerId] ?? (canCorrect && (status === 'ATTENDED' || status === 'NO_SHOW') ? status : undefined);
	const complete = eligible.every((participant) => statusFor(participant.playerId, participant.status) !== undefined);
	const mutation = useMutation({
		mutationFn: () => api.recordAttendance(night.id, eligible.map((participant) => ({
			playerId: participant.playerId,
			status: statusFor(participant.playerId, participant.status)!,
		}))),
		onSuccess: onRefresh,
		onError: onRefresh,
	});
	if (!canComplete && !canCorrect) return null;
	return <View style={[styles.card, { marginTop: 14 }]}>
		<Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>{t(canCorrect ? 'attendance.correct' : 'attendance.manage')}</Text>
		<Text style={[styles.subtitle, { marginTop: 8 }]}>{t('attendance.help')}</Text>
		{roster.isLoading ? <ActivityIndicator color={colors.green} style={{ marginTop: 12 }} /> : null}
		{roster.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 10 }}>{roster.error.message}</Text> : null}
		{!roster.isLoading && !roster.isError && eligible.length === 0 ? <Text style={[styles.subtitle, { marginTop: 12 }]}>{t('attendance.emptyRoster')}</Text> : null}
		{!roster.isLoading && !roster.isError ? eligible.map((participant) => {
			const selectedStatus = statusFor(participant.playerId, participant.status);
			return <View key={participant.playerId} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
				<Text style={{ color: colors.ink, fontWeight: '700' }}>{participant.displayName}</Text>
				<View style={[styles.row, { gap: 8, marginTop: 8 }]}>
					{(['ATTENDED', 'NO_SHOW'] as const).map((status) => {
						const checked = selectedStatus === status;
						return <Pressable key={status} accessibilityRole="radio" accessibilityState={{ checked, disabled: mutation.isPending }} disabled={mutation.isPending} onPress={() => setSelected((current) => ({ ...current, [participant.playerId]: status }))} style={[styles.secondaryButton, { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, checked && { backgroundColor: colors.green }]}>
							<Text style={[styles.secondaryText, checked && { color: colors.white }]}>{t(status === 'ATTENDED' ? 'attendance.attended' : 'attendance.noShow')}</Text>
						</Pressable>;
					})}
				</View>
			</View>;
		}) : null}
		{mutation.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 10 }}>{mutation.error.message}</Text> : null}
		<Pressable accessibilityRole="button" disabled={mutation.isPending || roster.isLoading || roster.isError || !complete} onPress={() => mutation.mutate()} style={[styles.button, { marginTop: 14 }, (mutation.isPending || roster.isLoading || roster.isError || !complete) && { opacity: 0.5 }]}>
			<Text style={styles.buttonText}>{mutation.isPending ? t('common.working') : t(canCorrect ? 'attendance.saveCorrections' : 'attendance.complete')}</Text>
		</Pressable>
	</View>;
}
function NightDetails({ night, canManage, actor, onBack, onRefresh }: { night: GameNight; canManage: boolean; actor: Player; onBack: () => void; onRefresh: () => Promise<unknown> }) {
	const { t } = useLanguage();
	const [current, setCurrent] = useState(night);
	useEffect(() => setCurrent(night), [night]);
	const canEdit = canManage && (current.status === 'DRAFT' || current.status === 'PUBLISHED');
	const canPublish = current.status === 'DRAFT'
		&& (actor.role === 'ADMIN' || (actor.role === 'ORGANIZER' && current.createdBy === actor.id));
	const publish = useMutation({
		mutationFn: () => api.publishNight(current.id),
		onSuccess: async (published) => { setCurrent(published); await onRefresh(); },
		onError: onRefresh,
	});
	return <>
		<Pressable onPress={onBack} style={{ marginBottom: 18 }}><Text style={{ color: colors.green, fontWeight: '800' }}>← {t('night.back')}</Text></Pressable>
		<Text style={styles.eyebrow}>{current.status}</Text>
		<Text style={[styles.title, { marginTop: 7 }]}>{current.title}</Text>
		{canPublish ? <View style={[styles.card, { marginTop: 14 }]}>
			{publish.isError ? <Text accessibilityRole="alert" style={{ color: colors.red, marginBottom: 10 }}>{publish.error.message}</Text> : null}
			<Pressable accessibilityRole="button" disabled={publish.isPending} onPress={() => publish.mutate()} style={[styles.button, publish.isPending && { opacity: 0.6 }]}>
				<Text style={styles.buttonText}>{publish.isPending ? t('common.working') : t('night.publish')}</Text>
			</Pressable>
		</View> : null}
		<AttendanceManager night={current} actor={actor} onRefresh={onRefresh} />
		<NightCard night={current} onRefresh={onRefresh} />
		<ParticipantManager night={current} canManage={canEdit} onRefresh={onRefresh} />
		{canEdit ? <><RegistrationManager night={current} onRefresh={onRefresh} /><SessionEditor night={current} onSaved={(updated) => { setCurrent(updated); onRefresh(); }} /></> : null}
	</>;
}
function Overview({ go, enabled }: { go: (tab: string) => void; enabled: boolean }) { const { t } = useLanguage(); const queryClient = useQueryClient(); const nights = useQuery({ queryKey: ['nights'], queryFn: () => api.nights(), enabled }); const player = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled }); if (!enabled || nights.isLoading || player.isLoading) return <ActivityIndicator color={colors.green} size="large" />; if (nights.isError || player.isError) return <ErrorState error={nights.error ?? player.error} />; const p = player.data!; return <><View style={[styles.between, { marginBottom: 24 }]}><View><Text style={styles.eyebrow}>{t('home.greeting', { name: p.displayName.toUpperCase() })}</Text><Text style={[styles.title, { marginTop: 7 }]}>{t('home.title')}</Text></View><Pressable onPress={() => go('profile')} style={{ backgroundColor: colors.mint, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.green, fontWeight: '900' }}>{p.displayName[0]}</Text></Pressable></View><View style={[styles.card, { backgroundColor: colors.green, marginBottom: 26 }]}><Text style={{ color: '#b9dfc5', fontWeight: '800' }}>{t('home.rank')}</Text><Text style={{ color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 8 }}>{p.rank.currentRank.title}</Text><Text style={{ color: '#d4edda', marginTop: 6 }}>{p.rank.attendedGameCount} · {p.rank.gamesUntilNextRank ? t('home.until', { count: p.rank.gamesUntilNextRank, rank: p.rank.nextRank?.title ?? '' }) : t('home.topRank')}</Text><View style={{ height: 7, backgroundColor: '#477b62', borderRadius: 8, marginTop: 18 }}><View style={{ height: 7, width: `${Math.min(100, p.rank.attendedGameCount * 10)}%`, backgroundColor: colors.gold, borderRadius: 8 }} /></View></View><View style={[styles.between, { marginBottom: 13 }]}><Text style={{ color: colors.ink, fontSize: 21, fontWeight: '800' }}>{t('home.upcoming')}</Text><Pressable onPress={() => go('nights')}><Text style={{ color: colors.green, fontWeight: '800' }}>{t('common.seeAll')}</Text></Pressable></View>{nights.data!.filter((n) => n.status !== 'CANCELLED').slice(0, 2).map((night) => <NightCard key={night.id} night={night} onDetails={() => go('nights')} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['nights'] })} />)}</>; }
function ErrorState({ error }: { error: Error | null }) { const router = useRouter(); const { t } = useLanguage(); const unauthorized = error?.message === 'Authentication required'; return <View style={[styles.card, { marginTop: 20 }]}><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{unauthorized ? t('error.expired') : t('error.load')}</Text><Text style={[styles.subtitle, { marginTop: 8 }]}>{unauthorized ? t('error.signIn') : error?.message ?? t('error.try')}</Text><Pressable onPress={() => unauthorized ? router.replace('/login') : undefined} style={[styles.button, { marginTop: 16 }]}><Text style={styles.buttonText}>{unauthorized ? t('error.login') : t('error.retry')}</Text></Pressable></View>; }
function Leaderboard() { const { t } = useLanguage(); const query = useQuery({ queryKey: ['leaderboard'], queryFn: () => api.leaderboard() }); if (query.isLoading) return <ActivityIndicator color={colors.green} />; if (query.isError) return <Text style={styles.subtitle}>{t('leaderboard.unavailable')}</Text>; return <><Text style={styles.eyebrow}>{t('home.community')}</Text><Text style={[styles.title, { marginTop: 7, marginBottom: 8 }]}>{t('nav.leaderboard')}</Text><Text style={[styles.subtitle, { marginBottom: 20 }]}>{t('leaderboard.subtitle')}</Text><View style={styles.card}>{query.data!.entries.map((entry, index) => <View key={entry.playerId} style={[styles.between, { paddingVertical: 13, borderBottomWidth: index === query.data!.entries.length - 1 ? 0 : 1, borderBottomColor: colors.line }]}><View style={styles.row}><Text style={{ width: 34, color: colors.gold, fontWeight: '900' }}>{String(index + 1).padStart(2, '0')}</Text><View><Text style={{ color: colors.ink, fontWeight: '800' }}>{entry.displayName}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{entry.rank.currentRank.title}</Text></View></View><Text style={{ color: colors.green, fontWeight: '900' }}>{entry.rank.attendedGameCount}</Text></View>)}</View></>; }
function Profile({ enabled }: { enabled: boolean }) { const { t } = useLanguage(); const query = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled }); if (!enabled || query.isLoading) return <ActivityIndicator color={colors.green} />; if (query.isError) return <ErrorState error={query.error} />; const p = query.data!; return <><Text style={styles.eyebrow}>{t('profile.identity')}</Text><Text style={[styles.title, { marginTop: 7 }]}>{t('nav.profile')}</Text><View style={[styles.card, { marginTop: 22, alignItems: 'center' }]}><View style={{ backgroundColor: colors.mint, width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 30, color: colors.green, fontWeight: '900' }}>{p.displayName[0]}</Text></View><Text style={{ color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 14 }}>{p.displayName}</Text><Text style={styles.subtitle}>{p.email}</Text><Badge>{p.role}</Badge></View><View style={[styles.card, { marginTop: 14 }]}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>{t('profile.progress')}</Text><Text style={[styles.subtitle, { marginTop: 10 }]}>{t('profile.attendedNights', { count: p.rank.attendedGameCount })}</Text><Text style={{ color: colors.green, fontWeight: '800', marginTop: 10 }}>{p.rank.currentRank.title} → {p.rank.nextRank?.title ?? t('profile.master')}</Text></View></>; }
export default function Home() {
	const { t } = useLanguage();
	const { width } = useWindowDimensions();
	const compact = width < 560;
	const [tab, setTab] = useState('home');
	const [authReady, setAuthReady] = useState(false);
	const [authenticated, setAuthenticated] = useState(false);
	const router = useRouter();
	useEffect(() => onAuthStateChanged(auth, (user) => { setAuthenticated(Boolean(user)); setAuthReady(true); if (!user && !process.env.EXPO_PUBLIC_DEMO_MODE) router.replace('/login'); }), [router]);
	const tabs = [['home', t('nav.home'), '⌂'], ['nights', t('nav.nights'), '♟'], ['leaderboard', t('nav.leaderboard'), '↗'], ['profile', t('nav.profile'), '○']];
	if (!authReady || (!authenticated && !process.env.EXPO_PUBLIC_DEMO_MODE)) return <SafeAreaView style={styles.page}><View style={[styles.shell, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={colors.green} size="large" /></View></SafeAreaView>;
	const enabled = authenticated || process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
	const logout = async () => { await signOut(auth); router.replace('/login'); };
	return <SafeAreaView style={styles.page}><View style={[styles.shell, { flex: 1, minHeight: 0, paddingHorizontal: compact ? 16 : 28, paddingVertical: compact ? 16 : 24 }]}>
		<View style={[styles.between, { marginBottom: compact ? 16 : 22 }]}><Text style={{ color: colors.green, fontSize: compact ? 18 : 20, fontWeight: '900', letterSpacing: 1 }}>TROY / BOTC</Text><View style={[styles.row, { gap: compact ? 10 : 14 }]}><LanguageSwitcher /><Pressable onPress={logout} accessibilityRole="button" hitSlop={8}><Text style={{ color: colors.red, fontWeight: '800', fontSize: compact ? 12 : 14 }}>{compact ? '↪' : t('nav.logout')}</Text></Pressable></View></View>
		<ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">{tab === 'home' && <Overview go={setTab} enabled={enabled} />}{tab === 'nights' && <><Text style={styles.eyebrow}>{t('home.findTable')}</Text><Text style={[styles.title, { marginTop: 7, marginBottom: 20, fontSize: compact ? 30 : 34 }]}>{t('nav.nights')}</Text><NightsList /></>}{tab === 'leaderboard' && <Leaderboard />}{tab === 'profile' && <Profile enabled={enabled} />}</ScrollView>
		<View style={[styles.row, { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: compact ? 4 : 6, justifyContent: 'space-around' }]}>{tabs.map(([key, label, icon]) => <Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab" style={{ flex: 1, minHeight: 52, padding: compact ? 6 : 10, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: tab === key ? colors.green : colors.muted, fontSize: compact ? 18 : 12, fontWeight: '800' }}>{compact ? icon : label}</Text>{compact && <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: tab === key ? colors.green : colors.muted, fontSize: 10, fontWeight: '800', marginTop: 2 }}>{label}</Text>}</Pressable>)}</View>
	</View></SafeAreaView>;
}
function NightsList() {
	const { t } = useLanguage();
	const queryClient = useQueryClient();
	const query = useQuery({ queryKey: ['nights'], queryFn: () => api.nights() });
	const player = useQuery({ queryKey: ['me'], queryFn: () => api.me() });
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [createdNight, setCreatedNight] = useState<GameNight | null>(null);
	const [creating, setCreating] = useState(false);
	if (query.isLoading || player.isLoading) return <ActivityIndicator color={colors.green} />;
	if (query.isError || player.isError) return <ErrorState error={query.error ?? player.error} />;
	const canManage = player.data?.role === 'ORGANIZER' || player.data?.role === 'ADMIN';
	if (creating && canManage) return <SessionCreator onCancel={() => setCreating(false)} onCreated={async (night) => {
		queryClient.setQueryData<GameNight[]>(['nights'], (current: GameNight[] | undefined) => [...(current ?? []).filter((item) => item.id !== night.id), night].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
		setCreatedNight(night);
		setSelectedId(night.id);
		setCreating(false);
		await queryClient.invalidateQueries({ queryKey: ['nights'] });
	}} />;
	const selected = query.data!.find((night) => night.id === selectedId) ?? (createdNight?.id === selectedId ? createdNight : null);
	if (selected) return <NightDetails night={selected} canManage={canManage} actor={player.data!} onBack={() => { setSelectedId(null); setCreatedNight(null); }} onRefresh={() => Promise.all([queryClient.invalidateQueries({ queryKey: ['nights'] }), queryClient.invalidateQueries({ queryKey: ['roster', selected.id] }), queryClient.invalidateQueries({ queryKey: ['me'] }), queryClient.invalidateQueries({ queryKey: ['leaderboard'] })])} />;
	return <>
		{canManage ? <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={[styles.button, { marginBottom: 20 }]}><Text style={styles.buttonText}>{t('night.create')}</Text></Pressable> : null}
		{query.data!.length === 0 ? <Text style={[styles.subtitle, { marginBottom: 14 }]}>{t('night.empty')}</Text> : null}
		{query.data!.map((night) => <View key={night.id}><NightCard night={night} onDetails={() => setSelectedId(night.id)} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['nights'] })} /></View>)}
	</>;
}
