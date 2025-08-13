import { useState, useEffect } from 'react';
import { fetchActiveEvents, fetchArchivedEvents, fetchEventDelete, fetchEventDetail, fetchUnfinalizeEvent } from '../api/events';
import { ActiveEvent, ArchivedEvent, EventDetails, EventFullResponse } from '../api/types';

export function useActiveEvents() {
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await fetchActiveEvents();
        setEvents(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  return { events, loading, error };
}

export function useArchivedEvents() {
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await fetchArchivedEvents();
        setEvents(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  return { events, loading, error };
}

export function useEvent(eventId?: number, eventPublicId?: string) {
  const [eventDetail, setEvent] = useState<EventFullResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const data = await fetchEventDetail(eventId, eventPublicId);
        setEvent(transformEventDates(data));
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  return { eventDetail, loading, error };
}

function transformEventDates(data: any): EventFullResponse {
  const transformDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr) : null;

  return {
    ...data,
    event: {
      ...data.event,
      created_at: new Date(data.event.created_at),
      updated_at: transformDate(data.event.updated_at),
      deleted_at: transformDate(data.event.deleted_at),
    },
    slots: data.slots.map((slot: any) => ({
      ...slot,
      slot_start: new Date(slot.slot_start),
      created_at: new Date(slot.created_at),
      voters: slot.voters?.map((voter: any) => ({
        ...voter,
        voted_at: new Date(voter.voted_at),
      })),
    })),
    current_user_votes: data.current_user_votes.map((vote: any) => ({
      ...vote,
      created_at: new Date(vote.created_at),
    })),
  };
}

export async function useDeleteEvent(eventId: number): Promise<boolean> {
  try {
    await fetchEventDelete(eventId);
    return true;
  } catch (err) {
    return false;
  };
};

export async function useUnfinalizeEvent(eventId: number): Promise<boolean> {
  try {
    await fetchUnfinalizeEvent(eventId);
    return true;
  } catch (err) {
    return false;
  };
};
