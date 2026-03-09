import {RecurrenceHandler} from "../types";

/**
 * Handler for weekly recurring events
 */
export class WeeklyRecurrenceHandler implements RecurrenceHandler {
  /**
   * Checks if this handler can process the given recurrence type
   * @param {string} recurrenceType - The type of recurrence
   * @return {boolean} True if this handler can process weekly recurrence
   */
  canHandle(recurrenceType: string): boolean {
    return recurrenceType === "weekly";
  }

  /**
   * Finds weekly occurrences of an event within a date range
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

    // Map day strings to their numeric values (0 = Sunday, 1 = Monday, etc.)
    const dayMap: { [key: string]: number } = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    // Convert daysOfWeek strings to numeric values
    const daysOfWeek = recurrence.days_of_week || [];
    const selectedDays = daysOfWeek.map((day: string) =>
      dayMap[day.toLowerCase()]
    );

    // Create a copy of the start date to iterate from
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      // For weekly events, add an occurrence on specified days of the week
      if (selectedDays.includes(dayOfWeek)) {
        const eventDate = new Date(currentDate);
        eventDate.setHours(hours, minutes, 0, 0);
        occurrences.push(eventDate);
      }

      // Move to the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return occurrences;
  }
}
