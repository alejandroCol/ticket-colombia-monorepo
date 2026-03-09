# Events Feature

This feature handles the creation of standalone events from recurring events using clean architecture principles and SOLID design patterns.

## Architecture Overview

The feature is organized following SOLID principles:

### 📁 Directory Structure

```
events/
├── types.ts                          # Interfaces and type definitions (ISP)
├── handlers/                         # Recurrence strategy handlers (OCP, LSP)
│   └── weekly-recurrence.handler.ts
├── repositories/                     # Data persistence layer (DIP)
│   └── firestore-event.repository.ts
├── services/                         # Business logic layer (SRP)
│   └── recurring-event.service.ts
├── factories/                        # Dependency injection (DIP)
│   └── event-service.factory.ts
└── index.ts                          # Public API exports
```

## SOLID Principles Applied

### 🎯 Single Responsibility Principle (SRP)
- **RecurringEventService**: Orchestrates the creation of standalone events
- **WeeklyRecurrenceHandler**: Handles weekly recurrence logic only
- **FirestoreEventRepository**: Manages data persistence only

### 🔓 Open/Closed Principle (OCP)
- **RecurrenceHandler interface**: Extensible for new recurrence types
- Adding new recurrence patterns (monthly, daily, yearly) requires only:
  1. Creating a new handler implementing `RecurrenceHandler`
  2. Adding it to the factory

### 🔄 Liskov Substitution Principle (LSP)
- All recurrence handlers can be substituted for the `RecurrenceHandler` interface
- Repository implementations are interchangeable via `EventRepository` interface

### 🧩 Interface Segregation Principle (ISP)
- Small, focused interfaces:
  - `RecurrenceHandler`: For handling recurrence logic
  - `EventRepository`: For data operations
  - `EventService`: For business operations

### ⬆️ Dependency Inversion Principle (DIP)
- High-level modules depend on abstractions (interfaces)
- Dependencies are injected via constructor
- Factory pattern manages dependency creation

## Usage

```typescript
import { EventServiceFactory } from './features/events';

// Create service with all dependencies configured
const eventService = EventServiceFactory.createEventService();

// Use the service
const result = await eventService.createStandaloneEvents(recurringEvent, eventId);
```

## Adding New Recurrence Types

To add a new recurrence type (e.g., monthly):

1. **Create a new handler**:
```typescript
// handlers/monthly-recurrence.handler.ts
export class MonthlyRecurrenceHandler implements RecurrenceHandler {
  canHandle(recurrenceType: string): boolean {
    return recurrenceType === "monthly";
  }
  
  findOccurrences(/* parameters */): Date[] {
    // Monthly recurrence logic
  }
}
```

2. **Update the factory**:
```typescript
// factories/event-service.factory.ts
const recurrenceHandlers: RecurrenceHandler[] = [
  new WeeklyRecurrenceHandler(),
  new MonthlyRecurrenceHandler(), // Add new handler
];
```

## Testing

The architecture facilitates easy testing through dependency injection:

```typescript
// Mock implementations for testing
const mockRepository = new MockEventRepository();
const mockHandlers = [new MockRecurrenceHandler()];
const service = new RecurringEventService(mockRepository, mockHandlers);
```

## Benefits

- ✅ **Maintainable**: Each class has a single responsibility
- ✅ **Extensible**: Easy to add new recurrence types
- ✅ **Testable**: Dependencies can be easily mocked
- ✅ **Decoupled**: Low coupling between components
- ✅ **Readable**: Clear separation of concerns 