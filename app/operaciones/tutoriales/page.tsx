import type { Metadata } from 'next';
import { TutorialCenter } from '@/components/tutorial/TutorialCenter';

export const metadata: Metadata = { title: 'Centro de Tutoriales' };

export default function TutorialCenterPage() {
  return <TutorialCenter audience="internal" />;
}
