import { useLocalSearchParams } from 'expo-router';
import Home from '../home';
export default function GameNight() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Home section="nights" nightId={id} />;
}
