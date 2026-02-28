import { Controller, Get } from '@nestjs/common';
import {
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { ActivityService } from './activity.service.js';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  getActivity(@Session() session: UserSession) {
    return this.activityService.getEvents(session.user.id);
  }
}
