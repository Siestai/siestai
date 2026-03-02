import { IsArray, Allow, IsOptional, IsString } from 'class-validator';

export class AgentChatDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsArray()
  messages: any[];

  @Allow()
  data?: any;

  @IsOptional()
  @IsString()
  trigger?: string;
}
