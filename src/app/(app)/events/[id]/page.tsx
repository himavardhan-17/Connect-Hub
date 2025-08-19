
import { EventDetailClient } from "./event-detail-client";

export default function EventDetailPage({ params }: { params: { id: string } }) {
  return <EventDetailClient eventId={params.id} />;
}
