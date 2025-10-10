import { MinLength, Matches, IsEmail, IsString } from "class-validator";

export class ResetDto {
  @IsEmail({}, { message: "Invalid email" })
  email: string;

  @IsString({ message: "Reset token must be a valid string" })
  resetToken: string;

  @MinLength(8, { message: "Password must be at least 8 characters" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{8,}$/, {
    message: "Weak password",
  })
  password: string;

  @MinLength(8)
  confirmPassword: string;
}
