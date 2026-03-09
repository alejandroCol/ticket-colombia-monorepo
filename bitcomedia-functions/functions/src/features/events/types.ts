import {Timestamp} from "firebase-admin/firestore";

export interface RecurringEvent {
  recurrence?: {
    type: string;
    days_of_week?: string[];
    time?: string;
  };
  recurrence_pattern?: any;
  [key: string]: any; // Allow additional properties
}

export interface StandaloneEvent {
  date: string;
  time: string;
  event_date: Timestamp;
  recurring_event_id: string;
  slug: string;
  [key: string]: any;
}

export interface EventOccurrence {
  date: Date;
  time: string;
}

export interface RecurrenceHandler {
  canHandle(recurrenceType: string): boolean;
  findOccurrences(
    startDate: Date,
    endDate: Date,
    recurrence: any,
    eventTime: string
  ): Date[];
}

export interface EventRepository {
  createEvents(events: StandaloneEvent[]): Promise<number>;
}

export interface EventService {
  createStandaloneEvents(
    recurringEvent: RecurringEvent,
    eventId: string
  ): Promise<{success: boolean; count?: number; error?: string}>;
}
