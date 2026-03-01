import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentFilesController } from './agent-files.controller';
import { AgentFilesService } from './agent-files.service';

@Module({
  imports: [ConfigModule],
  controllers: [AgentFilesController],
  providers: [AgentFilesService],
  exports: [AgentFilesService],
})
export class AgentFilesModule {}
