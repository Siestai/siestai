import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class PostTranscriptDto {
  @IsString()
  @IsNotEmpty()
  speaker: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
