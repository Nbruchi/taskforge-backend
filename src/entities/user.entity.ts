import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import { Task } from "./task.entity";
import { Workspace } from "./workspace.entity";
import { Invite } from "./invite.entity";
import { AuditLog } from "./audit-log.entity";
import { RefreshToken } from "./refresh-token.entity";
import { VerificationToken } from "./verification-token.entity";

@Entity("users") // SRS: Table name.
export class User {
  @PrimaryGeneratedColumn("uuid") // SRS: cuid-like UUID for id.
  id: string;

  @Column({ unique: true }) // SRS: Unique email.
  email: string;

  @Column() // SRS: Hashed password.
  password: string;

  @Column() // SRS: Display name.
  name: string;

  @Column({ default: false }) // SRS: isEmailVerified default false.
  isEmailVerified: boolean;

  @OneToMany(() => Task, (task) => task.owner) // SRS: Owned tasks.
  ownedTasks: Task[];

  @OneToMany(() => Task, (task) => task.assignees) // SRS: Assigned tasks (many-to-many).
  assignedTasks: Task[];

  @OneToMany(() => Workspace, (workspace) => workspace.owner) // SRS: Owned workspaces.
  ownedWorkspaces: Workspace[];

  @OneToMany(() => Workspace, (workspace) => workspace.members) // SRS: Member workspaces (many-to-many).
  memberWorkspaces: Workspace[];

  @OneToMany(() => Invite, (invite) => invite.sender) // SRS: Sent invites.
  sentInvites: Invite[];

  @OneToMany(() => AuditLog, (log) => log.user) // SRS: Audit logs.
  auditLogs: AuditLog[];

  @OneToMany(() => RefreshToken, (token) => token.user) // SRS: Refresh tokens.
  refreshTokens: RefreshToken[];

  @OneToMany(() => VerificationToken, (token) => token.user) // SRS: Verify/reset tokens.
  verificationTokens: VerificationToken[];

  @CreateDateColumn() // SRS: createdAt auto.
  createdAt: Date;

  @UpdateDateColumn() // SRS: updatedAt auto.
  updatedAt: Date;

  @DeleteDateColumn() // SRS: Soft delete.
  deletedAt?: Date;

  @Column({ type: "timestamp", nullable: true }) // SRS: lastLoginAt optional.
  lastLoginAt?: Date;
}
