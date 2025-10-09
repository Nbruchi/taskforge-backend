import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { Invite } from "./invite.entity";
import { AuditLog } from "./audit-log.entity";

@Entity("workspaces")
export class Workspace {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 50 }) // SRS: Name 1-50 chars.
  name: string;

  @Column({ nullable: true }) // SRS: Description optional.
  description?: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, (user) => user.ownedWorkspaces)
  owner: User;

  @OneToMany(() => Task, (task) => task.workspace)
  tasks: Task[];

  @ManyToMany(() => User, (user) => user.memberWorkspaces) // SRS: Members many-to-many.
  @JoinTable({ name: "workspace_members" })
  members: User[];

  @OneToMany(() => Invite, (invite) => invite.workspace)
  invites: Invite[];

  @OneToMany(() => AuditLog, (log) => log.workspace)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
