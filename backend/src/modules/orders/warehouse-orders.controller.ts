import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { OrdersService } from './orders.service';

@Controller('warehouse/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles(UserRole.warehouse)
  getWarehouseOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.getWarehouseOrders(query);
  }

  @Get('pending')
  @Roles(UserRole.warehouse)
  getPendingShipmentOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.getPendingShipmentOrders(query);
  }

  @Get(':id')
  @Roles(UserRole.warehouse)
  getWarehouseOrderDetail(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getWarehouseOrderDetail(id);
  }

  @Post(':id/ship')
  @Roles(UserRole.warehouse)
  shipOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() shipOrderDto: ShipOrderDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return this.ordersService.shipOrder(id, shipOrderDto, currentUser);
  }
}
