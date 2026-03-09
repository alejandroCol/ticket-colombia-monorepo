import {RecurringEventService} from "../services/recurring-event.service";
import {
  FirestoreEventRepository,
} from "../repositories/firestore-event.repository";
import {WeeklyRecurrenceHandler} from "../handlers/weekly-recurrence.handler";
import {DailyRecurrenceHandler} from "../handlers/daily-recurrence.handler";
import {EventService, RecurrenceHandler} from "../types";

/**
 * Factory for creating EventService instances with all dependencies
 */
export class EventServiceFactory {
  /**
   * Creates a fully configured EventService instance
   * @return {EventService} Configured event service
   */
  static createEventService(): EventService {
    // Repository
    const eventRepository = new FirestoreEventRepository();

    // Handlers - easily extensible for new recurrence types
    const recurrenceHandlers: RecurrenceHandler[] = [
      new WeeklyRecurrenceHandler(),
      new DailyRecurrenceHandler(),
      // Add more handlers here as needed (monthly, yearly, etc.)
    ];

    // Service with injected dependencies
    return new RecurringEventService(eventRepository, recurrenceHandlers);
  }
}
