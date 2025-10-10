import { InjectRedis } from "@nestjs-modules/ioredis";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import Redis from "ioredis";
import { User } from "src/entities/user.entity";
import { Repository } from "typeorm";
import { RegisterDto } from "./dtos/register.dto";
import { MailService } from "src/mail/mail.service";
import { LoginDto } from "./dtos/login.dto";
import { OtpType } from "src/enums/otp.enum";
import { Response } from "express";
import { ResetDto } from "./dtos/reset.dto";
import { randomBytes } from "crypto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string; user: User }> {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException("User already exists");
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });
    await this.userRepository.save(user);
    await this.mailService.sendEmailVerification(user.email, user.id);
    return { message: "User registered successfully", user };
  }

  async login(dto: LoginDto, response: Response): Promise<{ user: User }> {
    this.logger.log(`Login attempt for email: ${dto.email}`);
    const user = await this.validateUserCredentials(dto.email, dto.password);

    // Generate tokens
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.signRefreshToken(user),
    ]);

    // Set HTTP-only cookies
    const isProduction = this.configService.get("NODE_ENV") === "production";
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "strict" | "lax" | "none" | boolean;
      path: string;
      maxAge?: number;
    } = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      path: "/",
    };

    // Set access token cookie (short-lived)
    response.cookie("access_token", accessToken, {
      ...cookieOptions,
      maxAge:
        (this.configService.get<number>("JWT_ACCESS_EXPIRATION") || 3600) *
        1000, // 1 hour default
    });

    // Set refresh token cookie (longer-lived)
    response.cookie("refresh_token", refreshToken, {
      maxAge:
        (this.configService.get<number>("JWT_REFRESH_EXPIRATION") || 86400) *
        1000, // 24 hours default
    });

    // Don't return tokens in the response body
    return { user };
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshToken(
    refreshToken: string,
    response: Response,
  ): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken);

      // Check if it's a refresh token
      if (payload.type !== "refresh") {
        throw new UnauthorizedException("Invalid token type");
      }

      // Get user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      // Generate new access token only (refresh token remains valid)
      const accessToken = await this.signAccessToken(user);

      // Set the new access token in an HTTP-only cookie
      const isProduction = this.configService.get("NODE_ENV") === "production";
      const cookieOptions: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "strict" | "lax" | "none" | boolean;
        path: string;
        maxAge: number;
      } = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
        path: "/",
        maxAge:
          (this.configService.get<number>("JWT_ACCESS_EXPIRATION") || 3600) *
          1000,
      };

      response.cookie("access_token", accessToken, cookieOptions);

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  /**
   * Verify password reset token (Step 2)
   */
  async verifyPasswordResetToken(
    email: string,
    resetToken: string,
  ): Promise<{ message?: string }> {
    // Get reset token from redis
    const resetKey = `reset_token:${email}:${resetToken}`;
    const resetTokenData = await this.redis.get(resetKey);
    if (!resetTokenData) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    return {
      message: "Reset token verified successfully",
    };
  }

  /**
   * Reset password with token (Step 2)
   */
  async resetPasswordWithToken(dto: ResetDto): Promise<{ message?: string }> {
    // Validate password confirmation
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException(
        "Password confirmation does not match new password",
      );
    }

    // Get reset token from redis
    const resetKey = `reset_token:${dto.email}:${dto.resetToken}`;
    const resetTokenData = await this.redis.get(resetKey);
    if (!resetTokenData) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    // Get user and check if new password is same as old password
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new BadRequestException("User not found");
    }

    const isSamePassword = await bcrypt.compare(dto.password, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        "New password must be different from your current password",
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Update user password in db
    await this.userRepository.update(
      { email: dto.email },
      {
        password: hashedPassword,
      },
    );

    // Delete reset token from redis
    await this.redis.del(resetKey);

    // Send confirmation email
    await this.mailService.sendPasswordResetConfirmation(dto.email);

    return {
      message: "Password reset successfully",
    };
  }

  /**
   * Resend password reset OTP
   */
  async resendPasswordResetOtp(
    email: string,
  ): Promise<{ success: boolean; message?: string }> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    return this.mailService.sendPasswordReset(email, user.id);
  }

  async logout(response: Response): Promise<{ message: string }> {
    // Clear both cookies
    const isProduction = this.configService.get("NODE_ENV") === "production";
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "strict" | "lax" | "none" | boolean;
      path: string;
      maxAge?: number;
    } = {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge:
        (this.configService.get<number>("JWT_ACCESS_EXPIRATION") || 3600) *
        1000, // 1 hour default
    };

    response.clearCookie("access_token", cookieOptions);
    response.clearCookie("refresh_token", cookieOptions);

    return { message: "Logout successful" };
  }

  async getUserProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        "id",
        "name",
        "email",
        "isEmailVerified",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  private async validateUserCredentials(
    email: string,
    password: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException("Invalid email or pasword");
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException("First verify your email before logging in");
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for user ${user.email}`);
      throw new UnauthorizedException("Invalid email or pasword");
    }

    this.logger.log(`Successful login for user ${user.email}`);
    return user;
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.email,
      type: "access",
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get("JWT_ACCESS_EXPIRATION") || "1h",
    });
  }

  private async signRefreshToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.email,
      type: "refresh",
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get("JWT_REFRESH_EXPIRATION") || "7d",
    });
  }
}
