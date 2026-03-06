import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
