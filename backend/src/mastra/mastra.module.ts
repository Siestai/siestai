import { Global, Module } from '@nestjs/common';
import { MastraRegistryService } from './mastra-registry.service.js';

@Global()
@Module({
  providers: [MastraRegistryService],
  exports: [MastraRegistryService],
})
export class MastraModule {}
