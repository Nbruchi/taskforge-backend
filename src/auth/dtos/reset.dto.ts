import { IsString, MinLength, Matches } from "class-validator";

export class ResetDto {
  @IsString()
  token: string;

  @MinLength(8, { message: "Password must be at least 8 characters" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{8,}$/, {
    message: "Weak password",
  })
  password: string;

  @MinLength(8)
  confirmPassword: string;
}
