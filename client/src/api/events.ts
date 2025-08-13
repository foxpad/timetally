import { request } from './requests';
import { ActiveEvent, ArchivedEvent, EventDetails } from './types';

export async function fetchActiveEvents(): Promise<ActiveEvent[]> {
  return request('events/active');
}

export async function fetchArchivedEvents(): Promise<ArchivedEvent[]> {
  return request('events/archived');
}

export async function fetchEventDetail(eventId?: number, eventPublicId?: string): Promise<EventDetails> {
  if (!eventPublicId) {
    return request(`events/${eventId}`);
  } else {
    return request(`events/public/${eventPublicId}`);
  };
}

export async function fetchEventDelete(eventId: number): Promise<void> {
  return request(`events/${eventId}/delete`, 'POST');
}

export async function fetchUnfinalizeEvent(eventId: number): Promise<void> {
  return request(`events/${eventId}/unfinalize`, 'POST');
}