import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { OAuthService } from './oauth.service';
import { ToolRegistryService } from './tool-registry.service';

@Module({
  imports: [ConfigModule],
  controllers: [ToolsController],
  providers: [ToolsService, OAuthService, ToolRegistryService],
  exports: [ToolsService, OAuthService, ToolRegistryService],
})
export class ToolsModule {}
