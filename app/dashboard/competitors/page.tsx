import CompetitorDashboardClient from './competitor-dashboard-client';
import { getUniquePages } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function CompetitorDashboardPage() {
  const pages = await getUniquePages();

  return <CompetitorDashboardClient initialPages={pages} />;
}
