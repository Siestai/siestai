import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AgentPreviewDto {
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsString()
  @IsNotEmpty()
  instructions: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
