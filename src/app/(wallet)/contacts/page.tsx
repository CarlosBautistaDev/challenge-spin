import type { Metadata } from 'next';
import { ContactsScreen } from '@/features/contacts/contacts-screen';
export const metadata: Metadata = { title: 'Contactos' };
export default function ContactsPage() { return <ContactsScreen />; }
