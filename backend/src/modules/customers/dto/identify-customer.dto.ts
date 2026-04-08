import {
  IsMobilePhone,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class IdentifyCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsMobilePhone('zh-CN')
  mobile!: string;
}
