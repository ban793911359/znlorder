import { UserRole } from '@prisma/client';

export interface JwtUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}
