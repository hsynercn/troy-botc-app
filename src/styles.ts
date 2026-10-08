import { StyleSheet } from 'react-native';
export const colors = { ink: '#15231c', muted: '#718077', paper: '#f7f8f3', white: '#fffefa', green: '#1e5a43', mint: '#dff0e5', gold: '#d49b3f', line: '#e5e9e2', red: '#b44d49' };
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  shell: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.gold, fontWeight: '800', letterSpacing: 1.2, fontSize: 12, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 20 },
  button: { backgroundColor: colors.green, borderRadius: 12, minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  secondaryButton: { backgroundColor: colors.mint },
  secondaryText: { color: colors.green },
});
