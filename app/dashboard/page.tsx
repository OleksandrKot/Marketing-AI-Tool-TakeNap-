import DashboardClient from './dashboard-client';
import { getUniquePages } from '@/app/actions';

export default async function DashboardPage() {
  const competitors = await getUniquePages();
  return <DashboardClient initialCompetitors={competitors} />;
}
