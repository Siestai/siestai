import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailyFileService } from './daily-file.service';

@Injectable()
export class MemoryCronService {
  private readonly logger = new Logger(MemoryCronService.name);

  constructor(private readonly dailyFileService: DailyFileService) {}

  @Cron('0 3 * * *') // Daily at 03:00 UTC
  async handleDailyFileTransitions() {
    this.logger.log('Running daily file transitions...');
    try {
      const result = await this.dailyFileService.transitionDailyFiles();
      this.logger.log(
        `Daily file transitions complete: ${result.warmed} warmed, ${result.archived} archived`,
      );
    } catch (err) {
      this.logger.error(`Daily file transitions failed: ${err}`);
    }
  }
}
