import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { Workspace } from "./workspace.entity";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column() // SRS: Action e.g., CREATE_USER.
  action: string;

  @Column() // SRS: entityType e.g., User.
  entityType: string;

  @Column() // SRS: entityId string ref (polymorphic).
  entityId: string;

  @Column({ type: "jsonb", nullable: true }) // SRS: Details Json.
  details?: Record<string, any>;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  // Optional relations for specific types (SRS: Query via type/id).
  task?: Task;
  workspace?: Workspace;
}
