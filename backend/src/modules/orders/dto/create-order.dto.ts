import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsMobilePhone,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderItemInputDto } from './order-item-input.dto';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsMobilePhone('zh-CN')
  customerMobile!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wechatNickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiverName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiverMobile!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  receiverFullAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiverProvince?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiverCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiverDistrict?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  receiverAddress!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  paymentImageFileIds?: number[];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingFee?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number = 0;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  payableAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  operatorRemark?: string;
}
