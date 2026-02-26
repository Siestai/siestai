import { Body, Controller, Post } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { CreateTokenDto } from './dto/create-token.dto';

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Post('token')
  async createToken(@Body() dto: CreateTokenDto) {
    return this.livekitService.generateToken(dto);
  }
}
