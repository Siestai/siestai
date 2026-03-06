import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EmbeddingService } from './embedding.service';
import { MemoryService } from './memory.service';
import { DailyFileService } from './daily-file.service';
import { MdFilesService } from './md-files.service';
import { ContextAssemblyService } from './context-assembly.service';
import { RedisService } from './redis.service';
import { MemoryCronService } from './memory-cron.service';

@Global()
@Module({
  imports: [ConfigModule, ScheduleModule],
  providers: [
    EmbeddingService,
    MemoryService,
    DailyFileService,
    MdFilesService,
    ContextAssemblyService,
    RedisService,
    MemoryCronService,
  ],
  exports: [
    EmbeddingService,
    MemoryService,
    DailyFileService,
    MdFilesService,
    ContextAssemblyService,
    RedisService,
  ],
})
export class MemoryModule {}
