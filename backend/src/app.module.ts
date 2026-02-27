import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LivekitModule } from './livekit/livekit.module';
import { ArenaModule } from './arena/arena.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), LivekitModule, ArenaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
