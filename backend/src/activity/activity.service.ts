import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface ActivityEvent {
  id: string;
  type: 'agent_created' | 'agent_tested';
  agentName: string;
  timestamp: string;
}

@Injectable()
export class ActivityService {
  private events = new Map<string, ActivityEvent[]>();

  addEvent(userId: string, event: Omit<ActivityEvent, 'id'>) {
    const userEvents = this.events.get(userId) ?? [];
    userEvents.unshift({ ...event, id: randomUUID() });
    if (userEvents.length > 50) {
      userEvents.length = 50;
    }
    this.events.set(userId, userEvents);
  }

  getEvents(userId: string): ActivityEvent[] {
    return this.events.get(userId) ?? [];
  }
}
