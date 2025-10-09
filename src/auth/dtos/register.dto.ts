import { IsEmail, IsNotEmpty, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "Invalid email" })
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password: string;

  @IsNotEmpty()
  @MinLength(3, { message: "Name must be at least 3 characters" })
  @MaxLength(50, { message: "Name must be at most 50 characters" })
  name: string;
}
