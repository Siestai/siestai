import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class NativeAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}

export class CreateArenaSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  topic: string;

  @IsOptional()
  @IsString()
  @IsIn(['group', 'moderated'])
  mode?: string = 'group';

  @IsOptional()
  @IsString()
  @IsIn(['human_collab', 'agent_only'])
  participationMode?: string = 'human_collab';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NativeAgentDto)
  nativeAgents?: NativeAgentDto[];

  @IsOptional()
  @IsString()
  teamId?: string;
}
