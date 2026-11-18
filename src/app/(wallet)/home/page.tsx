import type { Metadata } from 'next';
import { HomeScreen } from '@/features/wallet/home';
export const metadata: Metadata = { title: 'Inicio' };
export default function HomePage() { return <HomeScreen />; }
