import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CustomersService } from './customers.service';
import { IdentifyCustomerDto } from './dto/identify-customer.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('identify')
  @Roles(UserRole.operator)
  identifyCustomer(@Query() query: IdentifyCustomerDto) {
    return this.customersService.identifyByMobile(query.mobile);
  }
}
