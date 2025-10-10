import { 
  Body, 
  Controller, 
  HttpCode, 
  HttpStatus, 
  Post, 
  Res, 
  Req,
  UseGuards,
  Get
} from "@nestjs/common";
import {type Request, type Response } from 'express';
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dtos/register.dto";
import { LoginDto } from "./dtos/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { user } = await this.authService.login(dto, response);
    return { user }; // Only return user data, tokens are in cookies
  }

  @UseGuards(RefreshTokenGuard)
  @Get("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }
    return this.authService.refreshToken(refreshToken, response);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    return this.authService.logout(response);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @HttpCode(HttpStatus.OK)
  getProfile(@Req() req: any) {
    return this.authService.getUserProfile(req.user.id);
  }
}
