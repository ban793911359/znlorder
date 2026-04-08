import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PublicOrderQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;
}
