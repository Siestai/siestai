import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  roomName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  identity: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  participantName?: string;
}
