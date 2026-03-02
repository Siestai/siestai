import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class ExecuteToolDto {
  @IsString()
  @IsNotEmpty()
  toolSlug: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsObject()
  params: Record<string, unknown>;

  @IsString()
  @IsOptional()
  userId?: string;
}
