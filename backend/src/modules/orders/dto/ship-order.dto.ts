import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ShipOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  courierCompany!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  trackingNo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shipmentRemark?: string;

  @IsOptional()
  @IsBoolean()
  isPartialShipment?: boolean;

  @IsOptional()
  @IsBoolean()
  isFullyShipped?: boolean;
}
