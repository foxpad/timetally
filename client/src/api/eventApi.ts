import { request } from './requests';
import { VoteData } from './types';

interface TimeSlots {
  date: string;
  timeSlots: string[];
}

interface EventDataCreate {
  title: string;
  description?: string;
  location?: string;
  dates: TimeSlots[];
  allowMultipleChoice: boolean;
  timezone: string;
  eventType: string;
}

export const createEvent = async (eventData: EventDataCreate) => {
  try {
    const response = await request("events/create", "POST", eventData);
    return response;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
};

interface EventDataUpdate {
  event: {
    id: number;
    public_id: string;
    title: string;
    description: string | null;
    location: string | null;
  };
  slots: Array<{
    id?: number;
    slot_start: string;
  }>;
  deletedSlotIds: number[];
}

export const updateEvent = async (updateData: EventDataUpdate) => {
  try {
    const response = await request(`events/${updateData.event.id}`, "PUT", updateData);
    return response;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
};

export const submitVotes = async (voteData: VoteData) => {
  try {
    const response = await request(`events/${voteData.event_id}/votes`, "POST", { slot_ids: voteData.slot_ids });
    return response;
  } catch (error) {
    console.error("Error submitting votes:", error);
    throw error;
  }
};

export const finalizedPoll = async (eventId: number, slotId: number, location?: string) => {
  try {
    const response = await request(`events/${eventId}/finalized`, "POST", { 
      slot_id: slotId,
      location: location 
    });
    return response;
  } catch (error) {
    console.error("Error finalizing poll:", error);
    throw error;
  }
};