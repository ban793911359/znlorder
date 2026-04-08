import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { comparePassword } from '../../common/utils/password.util';
import { LoginDto } from './dto/login.dto';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: loginDto.username },
    });

    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await comparePassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };

    return {
      success: true,
      data: {
        accessToken: await this.jwtService.signAsync(payload),
        user: payload,
      },
    };
  }
}
