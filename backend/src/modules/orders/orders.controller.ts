import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';
import { CancelOrderDto } from './dto/cancel-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.operator)
  createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return this.ordersService.createOrder(createOrderDto, currentUser);
  }

  @Get()
  @Roles(UserRole.operator)
  listOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOrders(query);
  }

  @Get(':id')
  @Roles(UserRole.operator)
  getOrderDetail(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getOrderDetail(id);
  }

  @Patch(':id')
  @Roles(UserRole.operator)
  updateOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return this.ordersService.updateOrder(id, updateOrderDto, currentUser);
  }

  @Post(':id/cancel')
  @Roles(UserRole.operator)
  cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelOrderDto: CancelOrderDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return this.ordersService.cancelOrder(id, cancelOrderDto, currentUser);
  }
}
