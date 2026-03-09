import {Timestamp} from "firebase-admin/firestore";
import {
  EventService,
  EventRepository,
  RecurrenceHandler,
  RecurringEvent,
  StandaloneEvent,
} from "../types";

/**
 * Service for creating standalone events from recurring events
 */
export class RecurringEventService implements EventService {
  private eventRepository: EventRepository;
  private recurrenceHandlers: RecurrenceHandler[];

  /**
   * Creates a new RecurringEventService instance
   * @param {EventRepository} eventRepository - Repository for event operations
   * @param {RecurrenceHandler[]} recurrenceHandlers - Array of handlers
   */
  constructor(
    eventRepository: EventRepository,
    recurrenceHandlers: RecurrenceHandler[]
  ) {
    this.eventRepository = eventRepository;
    this.recurrenceHandlers = recurrenceHandlers;
  }

  /**
   * Creates standalone events from a recurring event
   * @param {RecurringEvent} recurringEvent - The recurring event configuration
   * @param {string} eventId - ID of the recurring event
   * @return {Promise} Result object with success status and count or error
   */
  async createStandaloneEvents(
    recurringEvent: RecurringEvent,
    eventId: string
  ): Promise<{success: boolean; count?: number; error?: string}> {
    try {
      if (!recurringEvent.recurrence?.type) {
        return {
          success: false,
          error: "No recurrence type specified",
        };
      }

      // Find appropriate handler for this recurrence type
      const handler = this.recurrenceHandlers.find((h) =>
        h.canHandle(recurringEvent.recurrence?.type || "")
      );

      if (!handler) {
        const recurrenceType = recurringEvent.recurrence.type;
        return {
          success: false,
          error: `No handler found for recurrence type: ${recurrenceType}`,
        };
      }

      // Get recurrence information
      const eventTime = recurringEvent.recurrence.time || "00:00";

      // Find occurrences for next 30 days
      const now = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(now.getDate() + 30);

      const occurrences = handler.findOccurrences(
        now,
        thirtyDaysLater,
        recurringEvent.recurrence,
        eventTime
      );

      // Transform recurring event data to standalone events
      const standaloneEvents: StandaloneEvent[] = occurrences.map(
        (occurrence) => ({
          ...this.cleanRecurringEventData(recurringEvent),
          date: this.formatDate(occurrence),
          time: eventTime,
          event_date: Timestamp.fromDate(occurrence),
          recurring_event_id: eventId,
          slug: this.generateSlug(recurringEvent, occurrence),
        })
      );

      // Save events using repository
      const count = await this.eventRepository.createEvents(standaloneEvents);

      return {success: true, count};
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Removes recurrence-specific fields from recurring event data
   * @param {RecurringEvent} recurringEvent - The recurring event data
   * @return {any} Cleaned event data without recurrence fields
   */
  private cleanRecurringEventData(recurringEvent: RecurringEvent): any {
    const cleanData = {...recurringEvent};
    delete cleanData.recurrence;
    delete cleanData.recurrence_pattern;
    return cleanData;
  }

  /**
   * Generates a slug from event name and date
   * @param {RecurringEvent} recurringEvent - The recurring event data
   * @param {Date} date - The event occurrence date
   * @return {string} Generated slug
   */
  private generateSlug(recurringEvent: RecurringEvent, date: Date): string {
    // Get event name - common field names to check
    const eventName = recurringEvent.name ||
                     recurringEvent.title ||
                     recurringEvent.event_name ||
                     recurringEvent.event_title ||
                     "event";

    // Clean the event name: remove special characters and replace spaces with underscores
    const cleanName = String(eventName)
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, and hyphens
      .replace(/[\s-]+/g, "_") // Replace spaces and hyphens with underscores
      .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores

    // Format date as YYYY-MM-DD
    const formattedDate = this.formatDate(date);

    return `${cleanName}_${formattedDate}`;
  }

  /**
   * Formats a Date object as a YYYY-MM-DD string
   * @param {Date} date - The date to format
   * @return {string} Formatted date string
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
