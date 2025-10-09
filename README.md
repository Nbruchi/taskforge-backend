# Software Requirements Specification (SRS) for TaskForge

**Version**: 1.0  
**Date**: October 07, 2025  
**Author**: [Your Name], Solo Developer (RCA Alum, TV1 Intern)  
**Purpose**: Blueprint for production-ready collaborative task app—scalable, secure, AI-enhanced.

## 1. Introduction

### 1.1 Purpose

TaskForge is a real-time collaborative task management app for teams (e.g., devs, farmers co-ops, media crews). It beats basic to-dos (Trello clones) with AI parsing, audit trails, and soft deletes—built for production chaos (e.g., 100 users editing live without crashes). This SRS defines _everything_ to build: Features, logic, UI flows, errors. Goal: Portfolio showcase + scalable SaaS seed (freelance clients pay $10/mo for premium).

**MVP Scope**: Core collab (auth, tasks, real-time) + basics (invites, analytics). No overshoot: Skip payments phase 1.

### 1.2 Scope

- **In**: Full-stack web app (Next.js front, NestJS back, Prisma/Postgres). Real-time (Socket.io), AI (OpenAI free tier), analytics (simple charts).
- **Out**: Mobile app (web-responsive only), video calls, full payments (add Stripe in v2). No multi-lang (English only).
- **Users**: Free tier: Individuals/teams up to 5. Premium: Unlimited (but MVP free-only).
- **Assumptions**: Users have email/SMS access. Dev (you) uses free Vercel/Supabase for deploy.

### 1.3 Definitions & Acronyms

- **Entity**: DB "thing" (e.g., User = person record).
- **Soft Delete**: "Trash" without erasing—easy undo.
- **JWT**: Secure login token (like a temp passport).
- **N+1 Query**: Bad perf issue (one fetch snowballs)—we avoid with Prisma includes.
- **MVP**: Minimum stuff to ship and wow (not full fantasy).
- **Edge Case**: Weird "what if" (e.g., duplicate invite).

### 1.4 References

- Your TV1 schema (big relations, audits).
- Prisma docs (for relations).
- NestJS best practices (guards, validators).

### 1.5 Overview

Section 2: Overall description. 3: Functional reqs (what it does). 4: Non-functional (how well). 5: Use cases. 6: Data model. 7: Risks/overshoots.

## 2. Overall Description

### 2.1 Product Perspective

Like Trello + Notion + a dash of AI, but production-hardened: Soft deletes prevent "oops," audits track blame, real-time avoids email ping-pong. Diff from norm: AI turns "Call mom 5pm" into task; indexes keep it snappy at 10K tasks.

### 2.2 Product Functions

High-level: Login → Create/join workspace → Add/edit tasks (live) → Analytics → Invite/audit.

### 2.3 User Classes

- **Owner/Admin**: Creates workspaces, invites, views audits (e.g., TV1 lead).
- **Member**: Adds/edits tasks, gets alerts (team dev).
- **Guest/Invitee**: Views invite, joins (newbie).

### 2.4 Operating Environment

- Backend: Node 18+, Postgres local (prod: Supabase free).
- Frontend: Modern browsers (Chrome/Firefox).
- Deploy: Vercel (free tier, auto-scale).

### 2.5 Design Constraints

- JS-only (your stack: Next/Nest/React Native lite).
- Free tools: No paid AI beyond OpenAI $5 credit.
- Security: OWASP basics (hash passwords, CORS).

### 2.6 Assumptions & Dependencies

- Internet for AI/deploy.
- User emails work (no spam filter blocks).

## 3. Specific Requirements

### 3.1 External Interfaces

- **User**: Web UI (responsive, Tailwind)—login form, kanban board.
- **Hardware**: None (browser-based).
- **Software**: OpenAI API (parse text), Socket.io (live).
- **Comm**: HTTPS only; emails via Nodemailer (free SMTP like Gmail).

### 3.2 Functional Requirements

Broken by module. Each: ID, Description, Inputs/Outputs, Logic/Edges, Priority (M = MVP, N = Nice).

| ID    | Module/Feature            | Description (Simple)                 | Inputs                                                                                                                       | Outputs                                                                                        | Logic & Edge Cases                                                                                                                                                                       | Priority |
| ----- | ------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-01 | Auth: Signup              | New user joins with email/pass/name. | POST /auth/signup {email, password (8+ chars), name}                                                                         | 201 {token, user: {id, name, email}} or 400 "Weak pass"                                        | Hash pass (bcrypt). Check unique email (Prisma findUnique). Edge: Duplicate email → 409 "Taken." Invalid email format → 400 "Bad format" (regex: @domain). Rate limit: 5/min/IP.         | M        |
| FR-02 | Auth: Login               | Existing user enters creds.          | POST /auth/login {email, pass}                                                                                               | 200 {token, user} or 401 "Wrong creds"                                                         | Compare hash. Update lastLoginAt. Edge: Expired token → refresh logic (v2). Locked after 5 fails (temp ban 10min).                                                                       | M        |
| FR-03 | Auth: Logout/Protect      | End session; guard routes.           | DELETE /auth/logout (header: token)                                                                                          | 200 "Logged out"                                                                               | Blacklist token (Redis v2; now: client-side clear). All task routes @UseGuards(JwtGuard). Edge: Invalid token → 401 everywhere.                                                          | M        |
| FR-04 | Workspaces: Create        | Owner makes team room.               | POST /workspaces {name (1-50 chars), desc?} (auth req)                                                                       | 201 {id, name, desc, members: [owner]}                                                         | Link to ownerId. Edge: Name too long → 400. Owner deleted? Block (check deletedAt null).                                                                                                 | M        |
| FR-05 | Workspaces: List/View     | User sees their rooms.               | GET /workspaces (auth; query: ?ownerOnly=true)                                                                               | 200 [{id, name, desc, memberCount, createdAt}]                                                 | Filter where user in members or owner, deletedAt null. Include count via Prisma aggregate. Edge: No rooms → empty []. Slow? Index ownerId.                                               | M        |
| FR-06 | Workspaces: Update/Delete | Edit name/desc; soft delete.         | PATCH /workspaces/:id {name?, desc?} <br> DELETE /workspaces/:id                                                             | 200 updated <br> 204 no content                                                                | Only owner. Set deletedAt on delete (not hard). Edge: Not owner → 403. Cascades? No—tasks stay but hidden. Undo: Admin PATCH deletedAt null.                                             | M        |
| FR-07 | Tasks: Create             | Add task to workspace.               | POST /tasks {title (req, 1-100), desc?, dueDate (ISO string)?, priority (LOW/MED/HIGH), assigneeIds? [strings], workspaceId} | 201 {id, title, ... full task}                                                                 | Link owner, assignees (connectMany), workspace. Emit Socket 'taskCreated' to room. Log Audit: action='CREATE'. Edge: Invalid date → 400. Assignee not member → 400.                      | M        |
| FR-08 | Tasks: List/Filter        | Show tasks in workspace.             | GET /tasks?workspaceId=xx&status=IN_PROGRESS&overdue=true&priority=HIGH&limit=50&skip=0                                      | 200 [{id, title, status, dueDate, assignees: [{name}], ...}]                                   | Where deletedAt null, include owner/assignees (select name only—avoid N+1). Sort by dueDate. Edge: Overdue = dueDate < now(). Paginate for 10K+.                                         | M        |
| FR-09 | Tasks: Update             | Change title/status/etc.             | PATCH /tasks/:id {title?, status?, ...}                                                                                      | 200 updated task                                                                               | Only owner/assignees. Emit 'taskUpdated'. Log Audit with details: {oldStatus, newStatus}. Edge: Status invalid → 400 enum check. Due past + status=DONE → warn but allow.                | M        |
| FR-10 | Tasks: Delete             | Soft trash task.                     | DELETE /tasks/:id                                                                                                            | 204                                                                                            | Set deletedAt. Emit 'taskDeleted'. Log Audit. Edge: Undo via PATCH deletedAt null (admin only).                                                                                          | M        |
| FR-11 | Tasks: AI Parse           | Natural text to task.                | POST /tasks/ai {text (req), workspaceId, assigneeEmails?}                                                                    | 201 parsed task (or 400 "Can't parse")                                                         | OpenAI prompt: "Parse to JSON: {title, desc, dueDate (ISO), priority}." Create task from JSON. Edge: Bad parse (no title) → retry or manual. Rate: 10/day free user. Cache results (v2). | M        |
| FR-12 | Invites: Send             | Owner invites by email.              | POST /invites {email, workspaceId}                                                                                           | 201 {id, email, expiresAt (now+7d)}                                                            | Check email valid, not already member. Send email: "Join [name]? Accept: link." Log Audit. Edge: Self-invite → 400. Expires < now → ignore.                                              | M        |
| FR-13 | Invites: List/Accept      | View/accept invites.                 | GET /invites?accepted=false <br> PATCH /invites/:id/accept                                                                   | 200 list <br> 200 {accepted: true, workspaceId}                                                | Filter by user email. On accept: Add to members, set accepted. Edge: Expired → 410. Duplicate accept → no-op.                                                                            | M        |
| FR-14 | Real-Time: Join/Emit      | Live updates in room.                | Socket: 'joinWorkspace' {id} <br> (Auto on update: 'taskUpdated' {task})                                                     | Emit to room: 'taskUpdated' etc.                                                               | Auth socket with JWT. Rooms: 'workspace\_' + id. Edge: Disconnect → rejoin on reconnect. Max room 100 (scale v2).                                                                        | M        |
| FR-15 | Analytics: Stats          | Workspace insights.                  | GET /workspaces/:id/analytics?period=week                                                                                    | 200 {totalTasks: 50, completed: 30, overdue: 5, avgDue: 3days, topAssignee: {name, tasks: 10}} | Prisma: Count by status, groupBy assignee (select name). Edge: No data → zeros. Period filter: where createdAt > now-7d.                                                                 | N        |
| FR-16 | Audit: Logs               | View change history.                 | GET /audit?entityType=Task&entityId=xx&userId=yy&fromDate=...                                                                | 200 [{action, details, user: {name}, createdAt}]                                               | Filter where deletedAt null. Include user (select name). Edge: Admin-only; paginate.                                                                                                     | N        |

**Logic Coverage Note**: Every FR has edges (errors 4xx/5xx with messages). Validation: class-validator (e.g., @IsEmail). All actions log Audit unless read-only.

### 3.3 Non-Functional Requirements

| ID     | Category        | Description                                                                               | How to Meet                                                                                    | Priority |
| ------ | --------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| NFR-01 | Performance     | <200ms API response (95%ile); handle 100 concurrent (Socket).                             | Prisma pooling (default 10 conns). Vercel auto-scale. Test: Artillery load. Edge: Timeout 30s. | M        |
| NFR-02 | Security        | HTTPS; hash passes; JWT expire 1hr (refresh v2). CORS: frontend only. Rate limit 100/min. | Nest Guards. OWASP: No SQL inj (Prisma params). Audit all writes.                              | M        |
| NFR-03 | Usability       | Responsive UI (mobile OK). Dark mode toggle. Error toasts (e.g., "Task saved!").          | Tailwind. React Hook Form. i18n ready (English strings).                                       | M        |
| NFR-04 | Reliability     | 99% uptime. Soft deletes everywhere. Backup DB weekly (manual).                           | Vercel health checks. Try-catch all endpoints.                                                 | M        |
| NFR-05 | Scalability     | 10K users: Shard workspaces v2.                                                           | Monolith now; microservices later.                                                             | N        |
| NFR-06 | Maintainability | 80% test coverage (Jest). Docs: Swagger auto-gen.                                         | @nestjs/swagger. Comments in code.                                                             | N        |

## 4. Supporting Information

### 4.1 Use Cases (Top 5, Text Flows)

1. **UC-01: New Team Setup** – Owner signs up, creates workspace, invites 2 emails, accepts one. Logic: Auto-add owner to members. Success: 3 users in room.
2. **UC-02: Daily Task Flow** – Member logs in, views tasks (filter overdue), drags to IN_PROGRESS (live update), AI parses "Meeting Fri 3pm." Edge: No dueDate → today default.
3. **UC-03: Oops Recovery** – User deletes task, admin views audit, undeletes. Logic: deletedAt null restores.
4. **UC-04: Analytics Review** – Owner checks weekly stats; sees "John did 80%." No data? "Start tracking!"
5. **UC-05: Invite Fail** – Send to bad email; system emails bounce? Log, retry once.

### 4.2 Data Model (From Schema)

See our Prisma schema—it's the SRS heart. All relations bidirectional, indexes for hot paths (status queries). Soft delete global: Base filter `{ deletedAt: null }` in services.

### 4.3 Risks & Overshoots

- **Risk**: AI costs eat free tier—Mit: Cap 5 parses/user/day.
- **Overshoot Flag**: Analytics full ML? No—MVP simple counts. If tempted, remind: Ship core first, add in v2 after freelance cash.
- **Budget Check**: All free (Vercel/Supabase/OpenAI trial). Time: 20-30 hrs/module.
- **Delusion Check**: If "add VR kanban," slap: Focus MVP—prove it works, then dream.

## 5. Appendices

- **Change Log**: v1.0 - Oct 7, 2025 (Initial).
- **Glossary**: Kanban = drag columns; Emit = send live signal.

---
