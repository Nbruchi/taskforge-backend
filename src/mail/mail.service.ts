import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import * as nodemailer from "nodemailer";
import { User } from "src/entities/user.entity";
import { Repository } from "typeorm";
import { join } from "path";
import { readFileSync } from "fs";
import * as ejs from "ejs";
import { OtpType } from "src/enums/otp.enum";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
    cid?: string;
    contentDisposition?: "inline" | "attachment";
  }>;
}

export interface SendOtpOptions {
  email: string;
  userId?: string;
  metadata?: Record<string, any>;
  expiresInMinutes?: number;
  type: OtpType;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get("SMTP_HOST"),
      port: this.configService.get("SMTP_PORT"),
      secure: this.configService.get("SMTP_SECURE"),
      auth: {
        user: this.configService.get("SMTP_USER"),
        pass: this.configService.get("SMTP_PASS"),
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const { to, subject, template, context, attachments } = options;

      const templatePath = join(__dirname, "templates", `${template}.ejs`);
      const templateContent = readFileSync(templatePath, "utf-8");

      const templateContext = {
        ...context,
        appName: "Task Forge",
        appUrl: this.configService.get("APP_URL"),
      };

      const html = ejs.render(templateContent, templateContext, {
        async: true,
        cache: process.env.NODE_ENV === "production",
        filename: templatePath,
      });

      const fromAddress = this.configService.get("SMTP_FROM");

      await this.transporter.sendMail({
        from: {
          name: "Task Forge",
          address: fromAddress,
        },
        to,
        subject,
        html,
        attachments,
      });

      this.logger.log(`Email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error}`);
      return false;
    }
  }

  async sendOtp(options: SendOtpOptions): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const {
        email,
        userId,
        type,
        metadata = {},
        expiresInMinutes = 15,
      } = options;

      const existingUser = await this.userRepo.findOne({
        where: { email },
      });

      if (!existingUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      if (existingUser && existingUser.isEmailVerified) {
        return {
          success: false,
          message: "Email already verified",
        };
      }

      const code = Math.floor(100000 + Math.random() * 900000);

      const otpData = {
        code,
        email,
        type,
        userId,
        metadata,
        maxAttempts: 3,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
      };

      // Store OTP in Redis with TTL
      const otpKey = `otp:${type}:${email}:${code}`;
      const ttlSeconds = expiresInMinutes * 60;

      await this.redis.setex(otpKey, ttlSeconds, JSON.stringify(otpData));

      // Send OTP email
      const emailSent = await this.sendEmail({
        to: email,
        subject: this.getOtpSubject(type),
        template: "otp",
        context: {
          code,
          type,
          message: `Please enter the verification code below to ${type.toLowerCase().replace(/_/g, " ")}:`,
          isEmailVerification: type === OtpType.EMAIL_VERIFICATION,
          isPasswordReset: type === OtpType.PASSWORD_RESET,
          isLoginVerification: type === OtpType.LOGIN_VERIFICATION,
          expiresIn: expiresInMinutes, // Match the template variable name
          otpCode: code, // Template expects otpCode, not code
          ...metadata,
        },
      });

      if (!emailSent) {
        return {
          success: false,
          message: "Failed to send OTP email",
        };
      }
      this.logger.log(`OTP sent to ${email} for ${type}`);
      return {
        success: true,
        message: "OTP sent successfully",
      };
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${options.email}: ${error}`);
      return {
        success: false,
        message: "Failed to send OTP email",
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(
    code: string,
    email: string,
    type: OtpType,
  ): Promise<{ success: boolean; message?: string; otp?: any }> {
    try {
      const otpKey = `otp:${type}:${email}:${code}`;
      const otpDataStr = await this.redis.get(otpKey);

      if (!otpDataStr) {
        return {
          success: false,
          message: "Invalid OTP code or expired",
        };
      }

      const otpData = JSON.parse(otpDataStr);

      // Check if OTP has exceeded max attempts
      if (otpData.attempts >= otpData.maxAttempts) {
        // Delete the OTP after max attempts
        await this.redis.del(otpKey);
        return {
          success: false,
          message: "Too many failed attempts",
        };
      }

      // Increment attempts
      otpData.attempts += 1;

      // Mark as used and delete from Redis
      await this.redis.del(otpKey);

      this.logger.log(`OTP verified successfully for ${email}`);
      return {
        success: true,
        otp: otpData,
      };
    } catch (error) {
      this.logger.error(`Failed to verify OTP for ${email}:`, error);
      return {
        success: false,
        message: "Internal server error",
      };
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(
    email: string,
    userId?: string,
  ): Promise<{ success: boolean; message?: string }> {
    return this.sendOtp({
      email,
      type: OtpType.EMAIL_VERIFICATION,
      userId,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(user: User): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: "Welcome to our platform!",
      template: "welcome",
      context: {
        userName: user.name,
        email: user.email,
      },
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    email: string,
    userId?: string,
  ): Promise<{ success: boolean; message?: string }> {
    return this.sendOtp({
      email,
      type: OtpType.PASSWORD_RESET,
      userId,
    });
  }

  /**
   * Send password reset confirmation
   */
  async sendPasswordResetConfirmation(
    email: string,
    metadata?: {
      ipAddress?: string;
      location?: string;
      device?: string;
    },
  ): Promise<boolean> {
    // Get user info for the email template
    const user = await this.userRepo.findOne({ where: { email } });

    // Format timestamp
    const timestamp = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    return this.sendEmail({
      to: email,
      subject: "Password Reset Successful",
      template: "password-reset-confirmation",
      context: {
        email,
        userName: user?.name || "User",
        timestamp,
        location: metadata?.location || "Unknown",
        device: metadata?.device || "Unknown Device",
        resetPasswordUrl: this.configService.get(
          "app.webAppUrls.resetPassword",
        ),
        loginUrl: this.configService.get("app.webAppUrls.login"),
        supportUrl: this.configService.get("app.supportUrl"),
      },
    });
  }

  /**
   * Get OTP subject based on type
   */
  private getOtpSubject(type: OtpType): string {
    const subjects = {
      EMAIL_VERIFICATION: "Verify Your Email Address",
      PASSWORD_RESET: "Reset Your Password",
      LOGIN_VERIFICATION: "Login Verification Code",
      PHONE_VERIFICATION: "Phone Verification Code",
    };
    return subjects[type];
  }
}
``;
