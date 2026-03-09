import {RecurrenceHandler} from "../types";

/**
 * Handler for daily recurring events
 */
export class DailyRecurrenceHandler implements RecurrenceHandler {
  /**
   * Checks if this handler can process the given recurrence type
   * @param {string} recurrenceType - The type of recurrence
   * @return {boolean} True if this handler can process daily recurrence
   */
  canHandle(recurrenceType: string): boolean {
    return recurrenceType === "daily";
  }

  /**
   * Finds daily occurrences of an event within a date range
   * @param {Date} startDate - The start date of the range
   * @param {Date} endDate - The end date of the range
   * @param {any} recurrence - Recurrence configuration object
   * @param {string} eventTime - Time of the event in format "HH:MM"
   * @return {Date[]} Array of dates when the event occurs
   */
  findOccurrences(
    startDate: Date,
    endDate: Date,
    recurrence: any,
    eventTime: string
  ): Date[] {
    const occurrences: Date[] = [];
    const [hours, minutes] = eventTime.split(":").map(Number);

    // Get interval (default to 1 day if not specified)
    const interval = recurrence.interval || 1;

    // Create a copy of the start date to iterate from
    const currentDate = new Date(startDate);
    currentDate.setHours(hours, minutes, 0, 0);

    while (currentDate <= endDate) {
      // Add current date as an occurrence
      occurrences.push(new Date(currentDate));

      // Move to the next occurrence based on interval
      currentDate.setDate(currentDate.getDate() + interval);
    }

    return occurrences;
  }
}
