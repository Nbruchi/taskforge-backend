import {
  Controller,
  Post,
  Body,
  Delete,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dtos/register.dto";
import { LoginDto } from "./dtos/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard"; // Your guard.
import { Throttle } from "@nestjs/throttler";
import { type Response, type Request } from "express";
import { CurrentUser } from "src/decorators/current-user.decorator";
import { User } from "src/entities/user.entity";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // FR-01: POST /auth/signup—validate DTO, call service, set cookies.
  @Post("signup")
  @UsePipes(new ValidationPipe({ whitelist: true })) // SRS: Auto 400 on DTO fail.
  @Throttle({}) // SRS: 5/60s rate limit.
  async signup(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response, // SRS: Set cookies.
  ) {
    const result = await this.authService.signup(dto);
    await this.authService.setAuthCookies(
      res,
      result.data.access_token,
      result.data.refresh_token,
    );
    return result; // SRS: Spec response.
  }

  // FR-02: POST /auth/login—similar to signup.
  @Post("login")
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @Throttle({})
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signin(dto);
    await this.authService.setAuthCookies(
      res,
      result.data.access_token,
      result.data.refresh_token,
    );
    return result;
  }

  // Extended FR-03: POST /auth/refresh—extract from cookie, call service, rotate cookies.
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({}) // SRS: 10/60s.
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies["refresh_token"] ||
      req.headers["authorization"]?.replace("Bearer ", "");
    const result = await this.authService.refresh(refreshToken);
    await this.authService.setAuthCookies(
      res,
      result.data.access_token,
      result.data.refresh_token,
    );
    return result;
  }

  // Extended FR-03: DELETE /auth/logout—protected, call service, clear cookies.
  @Delete("logout")
  @UseGuards(JwtAuthGuard) // SRS: Protected—extract userId from req.user.sub.
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(user.id);
    await this.authService.clearAuthCookies(res);
    return result;
  }
}
