import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicOrderQueryDto } from './dto/public-order-query.dto';
import { OrdersService } from './orders.service';

@Controller('public/orders')
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':orderNo')
  getPublicOrderDetail(
    @Param('orderNo') orderNo: string,
    @Query() query: PublicOrderQueryDto,
  ) {
    return this.ordersService.getPublicOrderDetail(orderNo, query);
  }
}
