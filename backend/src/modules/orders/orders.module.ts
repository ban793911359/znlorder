import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsModule } from '../uploads/uploads.module';
import { OrderNumberService } from './order-number.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PublicOrdersController } from './public-orders.controller';
import { WarehouseOrdersController } from './warehouse-orders.controller';

@Module({
  imports: [ConfigModule, UploadsModule],
  controllers: [
    OrdersController,
    WarehouseOrdersController,
    PublicOrdersController,
  ],
  providers: [OrdersService, OrderNumberService],
  exports: [OrdersService],
})
export class OrdersModule {}
