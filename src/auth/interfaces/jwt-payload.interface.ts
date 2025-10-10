export interface JwtPayload {
  sub: string;  // user ID
  email: string;
  type: 'access' | 'refresh';
  iat?: number;  // issued at
  exp?: number;  // expiration time
}
