import { IsEmail, IsNotEmpty, MaxLength, MinLength } from "class-validator";
import { LoginDto } from "./login.dto";

export class RegisterDto extends LoginDto {
  @IsNotEmpty()
  @MinLength(3, { message: "Name must be at least 3 characters" })
  @MaxLength(50, { message: "Name must be at most 50 characters" })
  name: string;
}
