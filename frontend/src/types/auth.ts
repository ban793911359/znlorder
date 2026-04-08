export type UserRole = 'operator' | 'warehouse';

export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: UserInfo;
}
