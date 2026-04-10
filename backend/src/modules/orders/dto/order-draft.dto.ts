import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SaveOrderDraftDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, unknown>;
}

