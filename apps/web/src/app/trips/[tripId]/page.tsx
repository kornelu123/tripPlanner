import { TripEditor } from '@/components/trip-editor';

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripEditor tripId={tripId} />;
}
