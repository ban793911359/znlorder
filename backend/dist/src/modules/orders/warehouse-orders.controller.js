"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehouseOrdersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const list_orders_query_dto_1 = require("./dto/list-orders-query.dto");
const ship_order_dto_1 = require("./dto/ship-order.dto");
const orders_service_1 = require("./orders.service");
let WarehouseOrdersController = class WarehouseOrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    getWarehouseOrders(query) {
        return this.ordersService.getWarehouseOrders(query);
    }
    getPendingShipmentOrders(query) {
        return this.ordersService.getPendingShipmentOrders(query);
    }
    getWarehouseOrderDetail(id) {
        return this.ordersService.getWarehouseOrderDetail(id);
    }
    shipOrder(id, shipOrderDto, currentUser) {
        return this.ordersService.shipOrder(id, shipOrderDto, currentUser);
    }
};
exports.WarehouseOrdersController = WarehouseOrdersController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.UserRole.warehouse),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_orders_query_dto_1.ListOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], WarehouseOrdersController.prototype, "getWarehouseOrders", null);
__decorate([
    (0, common_1.Get)('pending'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.warehouse),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_orders_query_dto_1.ListOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], WarehouseOrdersController.prototype, "getPendingShipmentOrders", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.warehouse),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WarehouseOrdersController.prototype, "getWarehouseOrderDetail", null);
__decorate([
    (0, common_1.Post)(':id/ship'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.warehouse),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, ship_order_dto_1.ShipOrderDto, Object]),
    __metadata("design:returntype", void 0)
], WarehouseOrdersController.prototype, "shipOrder", null);
exports.WarehouseOrdersController = WarehouseOrdersController = __decorate([
    (0, common_1.Controller)('warehouse/orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], WarehouseOrdersController);
