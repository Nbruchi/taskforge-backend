import { IsEmail } from "class-validator";

export class ForgotDto {
  @IsEmail({}, { message: "Invalid email" })
  email: string;
}
