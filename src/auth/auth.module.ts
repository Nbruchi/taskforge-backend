import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PassportModule } from "@nestjs/passport"; // For guards/strategies.
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { User } from "../entities/user.entity"; // For repo.
import { AuditLog } from "../entities/audit-log.entity";
import { RefreshToken } from "../entities/refresh-token.entity";
import { VerificationToken } from "../entities/verification-token.entity";
import { JwtStrategy } from "./strategies/jwt.strategy"; // If you have it.
import { JwtAuthGuard } from "./guards/jwt-auth.guard"; // If you have it.

@Module({
  imports: [
    ConfigModule, // For ConfigService.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      AuditLog,
      RefreshToken,
      VerificationToken,
    ]),
    PassportModule, // For JwtStrategy/guards.
  ],
  providers: [
    AuthService,
    JwtStrategy, // Add if using guard.
    JwtAuthGuard, // Add if using guard.
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard], // Export for other modules.
})
export class AuthModule {}
