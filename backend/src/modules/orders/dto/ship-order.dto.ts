import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
  warehouseRemark?: string;
}
