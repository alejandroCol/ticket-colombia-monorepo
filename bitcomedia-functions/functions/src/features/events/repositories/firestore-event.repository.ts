import * as admin from "firebase-admin";
import {EventRepository, StandaloneEvent} from "../types";

/**
 * Firestore implementation of EventRepository
 */
export class FirestoreEventRepository implements EventRepository {
  private db: admin.firestore.Firestore;

  /**
   * Creates a new FirestoreEventRepository instance
   * @param {admin.firestore.Firestore} db - Optional Firestore instance
   */
  constructor(db?: admin.firestore.Firestore) {
    this.db = db || admin.firestore();
  }

  /**
   * Creates multiple events in Firestore using batch operations
   * @param {StandaloneEvent[]} events - Array of events to create
   * @return {Promise<number>} Number of events created
   */
  async createEvents(events: StandaloneEvent[]): Promise<number> {
    const batch = this.db.batch();
    let count = 0;

    for (const eventData of events) {
      const newEventRef = this.db.collection("events").doc();
      batch.set(newEventRef, eventData);
      count++;
    }

    await batch.commit();
    return count;
  }
}
