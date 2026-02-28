import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LivekitModule } from './livekit/livekit.module';
import { ArenaModule } from './arena/arena.module';
import { AgentsModule } from './agents/agents.module';
import { AgentPreviewModule } from './agents/preview/agent-preview.module';
import { ActivityModule } from './activity/activity.module';
import { auth } from './auth/auth';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule.forRoot({
      auth,
      middleware: (req, _res, next) => {
        req.url = req.originalUrl;
        req.baseUrl = '';
        next();
      },
    }),
    LivekitModule,
    ArenaModule,
    AgentsModule,
    AgentPreviewModule,
    ActivityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
