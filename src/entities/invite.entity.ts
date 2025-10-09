import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Workspace } from "./workspace.entity";

@Entity("invites")
export class Invite {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string; // SRS: Invite by email.

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.invites)
  workspace: Workspace;

  @Column()
  senderId: string;

  @ManyToOne(() => User, (user) => user.sentInvites)
  sender: User;

  @Column({ default: false }) // SRS: Accepted default false.
  accepted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true }) // SRS: expiresAt optional (7d).
  expiresAt?: Date;
}
