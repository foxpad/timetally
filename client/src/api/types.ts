export interface EventBase {
  id: number;
  public_id: string;
  title: string;
  event_type: string;
  is_creator: boolean;
  participant_count: number;
  final_slot_id?: number | null; // Соответствует полю final_slot_id из БД
  created_at: string;
}

export interface ActiveEvent extends EventBase {
}

export interface ArchivedEvent extends EventBase {
  is_deleted: boolean;
  is_expired: boolean;
}

export interface User {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

export interface SlotVoter extends User {
  voted_at: string;
}

export interface EventSlot {
  id: number;
  slot_start: string;
  created_at: string;
  current_user_voted: boolean;
  vote_count: number;
  voters?: SlotVoter[];
}

export interface EventDetails {
  id: number;
  public_id: string;
  title: string;
  description: string | null;
  location: string | null; 
  timezone: string;
  event_type: 'poll' | 'booking';
  multiple_choice: boolean;
  created_at: string; // или Date
  updated_at: string | null; // или Date
  deleted_at: string | null; // или Date
  user_id: number;
  final_slot_id: number | null;
  is_creator: boolean;
  creator: User;
}

export interface CurrentUserVote {
  slot_id: number;
  created_at: string;  // ISO format
}

export interface EventFullResponse {
  event: EventDetails;
  slots: EventSlot[];
  participants: User[];
  current_user_votes: CurrentUserVote[];  // Заменили массив объектов на типизированный
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type VoteData = {
  event_id: number;
  slot_ids: number[];
};