import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true }) // SRS: Unique token (hashed).
  token: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.refreshTokens)
  user: User;

  @Column({ type: "timestamp" }) // SRS: 7d expire.
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn() // SRS: Revoke soft.
  revokedAt?: Date;
}
