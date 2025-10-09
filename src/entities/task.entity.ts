import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from "typeorm";
import { User } from "./user.entity";
import { Workspace } from "./workspace.entity";
import { AuditLog } from "./audit-log.entity";

@Entity("tasks")
export class Task {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 100 }) // SRS: Title req, 1-100 chars.
  title: string;

  @Column({ nullable: true }) // SRS: Description optional.
  description?: string;

  @Column({ type: "timestamp", nullable: true }) // SRS: dueDate optional.
  dueDate?: Date;

  @Column({
    // SRS: Status enum.
    type: "enum",
    enum: ["TODO", "IN_PROGRESS", "DONE"],
    default: "TODO",
  })
  status: "TODO" | "IN_PROGRESS" | "DONE";

  @Column({
    // SRS: Priority enum.
    type: "enum",
    enum: ["LOW", "MEDIUM", "HIGH"],
    default: "MEDIUM",
  })
  priority: "LOW" | "MEDIUM" | "HIGH";

  @Column() // SRS: ownerId FK.
  ownerId: string;

  @ManyToOne(() => User, (user) => user.ownedTasks) // SRS: Owner relation.
  owner: User;

  @ManyToMany(() => User, (user) => user.assignedTasks) // SRS: Assignees many-to-many.
  @JoinTable({ name: "task_assignees" }) // Junction table auto.
  assignees: User[];

  @Column() // SRS: workspaceId FK.
  workspaceId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.tasks)
  workspace: Workspace;

  @OneToMany(() => AuditLog, (log) => log.task) // SRS: Audit logs for this task.
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
