import * as admin from "firebase-admin";
import {Ticket, TicketRepository} from "../types";

/**
 * Implementación del repositorio de tickets usando Firestore
 */
export class FirestoreTicketRepository implements TicketRepository {
  private db: admin.firestore.Firestore;
  private collection = "tickets";

  /**
   * Constructor del repositorio de tickets
   */
  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Crea un nuevo ticket en Firestore
   * @param {Omit<Ticket, "createdAt" | "updatedAt">} ticket - Datos del ticket
   * @return {Promise<string>} ID del ticket creado
   */
  async create(
    ticket: Omit<Ticket, "createdAt" | "updatedAt">
  ): Promise<string> {
    try {
      const ticketRef = this.db.collection(this.collection).doc();
      const ticketData = {
        ...ticket,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await ticketRef.set(ticketData);
      console.log(`Ticket created with ID: ${ticketRef.id}`);

      return ticketRef.id;
    } catch (error) {
      console.error("Error creating ticket:", error);
      const errorMessage = `Failed to create ticket: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Busca un ticket por su ID
   * @param {string} ticketId - ID del ticket
   * @return {Promise<Ticket | null>} Ticket encontrado o null
   */
  async findById(ticketId: string): Promise<Ticket | null> {
    try {
      const ticketDoc = await this.db
        .collection(this.collection)
        .doc(ticketId)
        .get();

      if (!ticketDoc.exists) {
        return null;
      }

      return {
        ...ticketDoc.data(),
      } as Ticket;
    } catch (error) {
      console.error(`Error finding ticket ${ticketId}:`, error);
      const errorMessage = `Failed to find ticket: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Actualiza un ticket
   * @param {string} ticketId - ID del ticket
   * @param {Partial<Ticket>} updates - Campos a actualizar
   */
  async update(ticketId: string, updates: Partial<Ticket>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await this.db
        .collection(this.collection)
        .doc(ticketId)
        .update(updateData);
      console.log(`Ticket ${ticketId} updated successfully`);
    } catch (error) {
      console.error(`Error updating ticket ${ticketId}:`, error);
      const errorMessage = `Failed to update ticket: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Busca un ticket por ID de pago
   * @param {string} paymentId - ID del pago
   * @return {Promise<Ticket | null>} Ticket encontrado o null
   */
  async findByPaymentId(paymentId: string): Promise<Ticket | null> {
    try {
      const query = await this.db
        .collection(this.collection)
        .where("paymentId", "==", paymentId)
        .limit(1)
        .get();

      if (query.empty) {
        return null;
      }

      const doc = query.docs[0];
      return {
        ...doc.data(),
      } as Ticket;
    } catch (error) {
      console.error(`Error finding ticket by payment ID ${paymentId}:`, error);
      const errorMessage = `Failed to find ticket by payment ID: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Busca todos los tickets de un usuario
   * @param {string} userId - ID del usuario
   * @return {Promise<Ticket[]>} Lista de tickets del usuario
   */
  async findByUserId(userId: string): Promise<Ticket[]> {
    try {
      const query = await this.db
        .collection(this.collection)
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();

      return query.docs.map((doc) => ({
        ...doc.data(),
      })) as Ticket[];
    } catch (error) {
      console.error(`Error finding tickets for user ${userId}:`, error);
      const errorMessage = `Failed to find tickets for user: ${
        (error as Error).message}`;
      throw new Error(errorMessage);
    }
  }
}
