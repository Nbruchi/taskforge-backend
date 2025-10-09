import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("verification_tokens")
export class VerificationToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true }) // SRS: Unique token (uuid).
  token: string;

  @Column() // SRS: type 'email' or 'reset'.
  type: "email" | "reset";

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.verificationTokens)
  user: User;

  @Column({ type: "timestamp" }) // SRS: 15min expire.
  expiresAt: Date;

  @Column({ type: "timestamp", nullable: true }) // SRS: usedAt on success.
  usedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
