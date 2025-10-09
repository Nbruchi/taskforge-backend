import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import databaseConfig from "./config/database.config";
import { AuditLog } from "./entities/audit-log.entity";
import { Invite } from "./entities/invite.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { Task } from "./entities/task.entity";
import { User } from "./entities/user.entity";
import { VerificationToken } from "./entities/verification-token.entity";
import { Workspace } from "./entities/workspace.entity";
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          type: "postgres",
          host: configService.get<string>("database.host"),
          port: configService.get<number>("database.port"),
          username: configService.get<string>("database.user"),
          password: configService.get<string>("database.password"),
          database: configService.get<string>("database.name"),
          entities: [
            AuditLog,
            Invite,
            RefreshToken,
            Task,
            User,
            VerificationToken,
            Workspace,
          ],
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
