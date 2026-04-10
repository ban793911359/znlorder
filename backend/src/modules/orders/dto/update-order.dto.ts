import { Type } from 'class-transformer';
import {
  IsArray,
  IsMobilePhone,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderItemInputDto } from './order-item-input.dto';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @IsMobilePhone('zh-CN')
  customerMobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wechatNickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiverMobile?: string;

  @IsOptional()
  @IsString()
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
  receiverAddress?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items?: OrderItemInputDto[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  paymentImageFileIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  payableAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  operatorRemark?: string;
}
