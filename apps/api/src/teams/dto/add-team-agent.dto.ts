import { IsString, IsOptional, IsUUID } from 'class-validator';

export class AddTeamAgentDto {
  @IsUUID()
  agentId: string;

  @IsString()
  @IsOptional()
  role?: string;
}
