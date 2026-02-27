import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class JoinArenaDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  agentName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;
}
