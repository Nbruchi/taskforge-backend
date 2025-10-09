import { IsEmail, IsNotEmpty, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Invalid email" })
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(50, { message: "Password must be at most 50 characters" })
  password: string;
}
