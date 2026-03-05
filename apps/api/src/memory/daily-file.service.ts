import { Injectable, Logger } from '@nestjs/common';
import {
  db,
  dailyMemoryFiles,
  eq,
  and,
  desc,
  sql,
} from '@siestai/db';

@Injectable()
export class DailyFileService {
  private readonly logger = new Logger(DailyFileService.name);

  async appendToDaily(
    scopeType: 'agent' | 'team',
    scopeId: string,
    date: string,
    content: string,
  ) {
    const existing = await db
      .select()
      .from(dailyMemoryFiles)
      .where(
        and(
          eq(dailyMemoryFiles.scopeType, scopeType),
          eq(dailyMemoryFiles.scopeId, scopeId),
          eq(dailyMemoryFiles.date, date),
        ),
      );

    if (existing.length > 0) {
      const updated = existing[0].content + '\n\n' + content;
      await db
        .update(dailyMemoryFiles)
        .set({ content: updated, updatedAt: new Date() })
        .where(eq(dailyMemoryFiles.id, existing[0].id));
      return;
    }

    await db.insert(dailyMemoryFiles).values({
      scopeType,
      scopeId,
      date,
      content,
      status: 'active',
    });
  }

  async getActiveDailyFiles(
    scopeType: 'agent' | 'team',
    scopeId: string,
    days = 7,
  ) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return db
      .select()
      .from(dailyMemoryFiles)
      .where(
        and(
          eq(dailyMemoryFiles.scopeType, scopeType),
          eq(dailyMemoryFiles.scopeId, scopeId),
          sql`${dailyMemoryFiles.date} >= ${cutoffStr}`,
          eq(dailyMemoryFiles.status, 'active'),
        ),
      )
      .orderBy(desc(dailyMemoryFiles.date));
  }

  async transitionDailyFiles() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Active -> Warm (older than 7 days)
    const warmed = await db
      .update(dailyMemoryFiles)
      .set({ status: 'warm', updatedAt: now })
      .where(
        and(
          eq(dailyMemoryFiles.status, 'active'),
          sql`${dailyMemoryFiles.date} < ${sevenDaysAgo.toISOString().split('T')[0]}`,
        ),
      )
      .returning({ id: dailyMemoryFiles.id });

    // Warm -> Archived (older than 30 days)
    const archived = await db
      .update(dailyMemoryFiles)
      .set({ status: 'archived', updatedAt: now })
      .where(
        and(
          eq(dailyMemoryFiles.status, 'warm'),
          sql`${dailyMemoryFiles.date} < ${thirtyDaysAgo.toISOString().split('T')[0]}`,
        ),
      )
      .returning({ id: dailyMemoryFiles.id });

    this.logger.log(
      `Daily file transitions: ${warmed.length} active->warm, ${archived.length} warm->archived`,
    );

    return { warmed: warmed.length, archived: archived.length };
  }
}
