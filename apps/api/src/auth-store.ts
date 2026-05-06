import { createHash, randomUUID } from "node:crypto";
import { syntheticIds } from "@eyther/contracts";
import { createPrismaClient, type EytherPrismaClient } from "@eyther/db";

export const syntheticEmail = "insurance.desk@example.test";
export const syntheticOtp = "000000";
export const syntheticLoginChallengeId = "LOGIN-TEST-0001";

export type AuthUser = {
  user_id: string;
  tenant_id: string;
  hospital_id: string;
  name: string;
  email: string;
  roles: string[];
  branch_scope: { all_branches: boolean; branch_ids: string[] };
};

export type LoginChallengeView = {
  login_challenge_id: string;
  delivery: "synthetic_email";
  masked_destination: string;
  expires_at: string;
};

export type SessionIssue = {
  token: string;
  user: AuthUser;
  session_fresh_until: string;
};

export type SessionRecord = {
  session_id: string;
  user: AuthUser;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  session_fresh_until: string;
};

export type InviteView = {
  invite_id: string;
  invite_status: "pending" | "accepted" | "expired" | "revoked";
  hospital: { display_name: string; city: string; state: string };
  email_masked: string;
  requested_roles: string[];
  branch_scope: { all_branches: boolean; branch_ids: string[] };
  expires_at: string;
};

export type AcceptInviteResult =
  | {
      status: "accepted";
      invite_id: string;
      invite_status: "accepted";
      session: SessionIssue;
      audit_actions: readonly ["user_invite_accept", "login"];
    }
  | { status: "not_found" }
  | { status: "validation_error" }
  | { status: "not_accepting" };

export type AuthStore = {
  startLogin(email: string | undefined): Promise<LoginChallengeView | null>;
  verifyLogin(
    loginChallengeId: string | undefined,
    otp: string | undefined,
  ): Promise<SessionIssue | null>;
  getInvite(inviteId: string): Promise<InviteView | null>;
  acceptInvite(
    inviteId: string,
    input: { name?: string; phone?: string | null; otp?: string },
  ): Promise<AcceptInviteResult>;
  getSessionByToken(token: string | undefined): Promise<SessionRecord | null>;
  revokeSessionByToken(token: string | undefined): Promise<boolean>;
  close?(): Promise<void>;
};

const authUser: AuthUser = {
  user_id: syntheticIds.userId,
  tenant_id: syntheticIds.tenantId,
  hospital_id: syntheticIds.hospitalId,
  name: "Insurance Desk Test Owner",
  email: syntheticEmail,
  roles: ["hospital_admin", "claim_officer", "billing_finance"],
  branch_scope: { all_branches: true, branch_ids: [] },
};

function nowIso() {
  return new Date().toISOString();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "in***@example.test";
  return `${name.slice(0, 2)}***@${domain}`;
}

function sessionDates() {
  return {
    freshUntil: new Date(Date.now() + 30 * 60 * 1000),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  };
}

function challengeExpiresAt() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

function inviteExpiresAt() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function branchScopeFromPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null)
    return { all_branches: false, branch_ids: [] };
  const scope = payload as {
    all_branches?: unknown;
    allBranches?: unknown;
    branch_ids?: unknown;
    branchIds?: unknown;
  };
  const ids = Array.isArray(scope.branch_ids)
    ? scope.branch_ids
    : Array.isArray(scope.branchIds)
      ? scope.branchIds
      : [];
  return {
    all_branches: Boolean(scope.all_branches ?? scope.allBranches),
    branch_ids: ids.filter((id): id is string => typeof id === "string"),
  };
}

function userFromPrismaRecord(user: any): AuthUser {
  const roles = (user.roleAssignments ?? [])
    .filter((assignment: any) => assignment.assignmentStatus === "active")
    .map((assignment: any) => assignment.roleKey);
  const scopes = (user.branchScopes ?? []).filter(
    (scope: any) => scope.scopeStatus === "active",
  );
  const allBranches = scopes.some((scope: any) => scope.allBranches);
  const branchIds = scopes
    .map((scope: any) => scope.branchId)
    .filter(
      (branchId: unknown): branchId is string => typeof branchId === "string",
    );

  return {
    user_id: user.userId,
    tenant_id: user.tenantId,
    hospital_id: user.hospitalId,
    name: user.name,
    email: user.email,
    roles,
    branch_scope: { all_branches: allBranches, branch_ids: branchIds },
  };
}

export function hashSessionToken(token: string) {
  return hashValue(token);
}

export function createInMemoryAuthStore(): AuthStore {
  let inviteStatus: InviteView["invite_status"] = "pending";
  const authSessions = new Map<string, SessionRecord>();

  function issueSession(): SessionIssue {
    const token = randomUUID();
    const { freshUntil, expiresAt } = sessionDates();
    const sessionFreshUntil = freshUntil.toISOString();

    authSessions.set(hashSessionToken(token), {
      session_id: randomUUID(),
      user: authUser,
      created_at: nowIso(),
      expires_at: expiresAt.toISOString(),
      revoked_at: null,
      session_fresh_until: sessionFreshUntil,
    });

    return { token, user: authUser, session_fresh_until: sessionFreshUntil };
  }

  return {
    async startLogin(email) {
      if (normalizeEmail(email) !== syntheticEmail) return null;
      return {
        login_challenge_id: syntheticLoginChallengeId,
        delivery: "synthetic_email",
        masked_destination: "in***@example.test",
        expires_at: challengeExpiresAt().toISOString(),
      };
    },
    async verifyLogin(loginChallengeId, otp) {
      if (
        loginChallengeId !== syntheticLoginChallengeId ||
        otp !== syntheticOtp
      )
        return null;
      return issueSession();
    },
    async getInvite(inviteId) {
      if (inviteId !== syntheticIds.inviteId) return null;
      return {
        invite_id: inviteId,
        invite_status: inviteStatus,
        hospital: {
          display_name: "Lotus Valley Test Hospital",
          city: "Indore",
          state: "Madhya Pradesh",
        },
        email_masked: "in***@example.test",
        requested_roles: authUser.roles,
        branch_scope: authUser.branch_scope,
        expires_at: inviteExpiresAt().toISOString(),
      };
    },
    async acceptInvite(inviteId, input) {
      if (inviteId !== syntheticIds.inviteId) return { status: "not_found" };
      if (!input.name?.trim() || input.otp !== syntheticOtp)
        return { status: "validation_error" };

      inviteStatus = "accepted";
      return {
        status: "accepted",
        invite_id: inviteId,
        invite_status: "accepted",
        session: issueSession(),
        audit_actions: ["user_invite_accept", "login"],
      };
    },
    async getSessionByToken(token) {
      if (!token) return null;
      const session = authSessions.get(hashSessionToken(token));
      if (
        !session ||
        session.revoked_at ||
        Date.parse(session.expires_at) <= Date.now()
      )
        return null;
      return session;
    },
    async revokeSessionByToken(token) {
      if (!token) return false;
      const session = authSessions.get(hashSessionToken(token));
      if (!session || session.revoked_at) return false;
      session.revoked_at = nowIso();
      return true;
    },
  };
}

export class PrismaAuthStore implements AuthStore {
  constructor(private readonly prisma: EytherPrismaClient) {}

  async startLogin(email: string | undefined) {
    const emailNormalized = normalizeEmail(email);
    const user = await (this.prisma as any).hospitalUser.findFirst({
      where: { loginIdentifierEmail: emailNormalized, userStatus: "active" },
    });
    if (!user) return null;

    const challenge = await (this.prisma as any).authLoginChallenge.create({
      data: {
        tenantId: user.tenantId,
        hospitalId: user.hospitalId,
        userId: user.userId,
        emailNormalized,
        otpHash: hashValue(syntheticOtp),
        delivery: "synthetic_email",
        expiresAt: challengeExpiresAt(),
      },
    });

    return {
      login_challenge_id: challenge.loginChallengeId,
      delivery: "synthetic_email" as const,
      masked_destination: maskEmail(emailNormalized),
      expires_at: challenge.expiresAt.toISOString(),
    };
  }

  async verifyLogin(
    loginChallengeId: string | undefined,
    otp: string | undefined,
  ) {
    if (!loginChallengeId || !otp) return null;
    const challenge = await (this.prisma as any).authLoginChallenge.findUnique({
      where: { loginChallengeId },
      include: {
        user: {
          include: {
            roleAssignments: { where: { assignmentStatus: "active" } },
            branchScopes: { where: { scopeStatus: "active" } },
          },
        },
      },
    });

    const invalid =
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.otpHash !== hashValue(otp) ||
      !challenge.user ||
      challenge.user.userStatus !== "active";

    if (invalid) {
      if (challenge) {
        await (this.prisma as any).authLoginChallenge.update({
          where: { loginChallengeId },
          data: { failedAttempts: { increment: 1 } },
        });
        await this.audit(
          "failed_login",
          "auth_login_challenge",
          loginChallengeId,
          challenge.tenantId,
          challenge.hospitalId,
          challenge.userId ?? null,
        );
      }
      return null;
    }

    return this.issuePrismaSession(challenge.user, async (tx) => {
      await tx.authLoginChallenge.update({
        where: { loginChallengeId },
        data: { consumedAt: new Date() },
      });
      await tx.hospitalUser.update({
        where: { userId: challenge.user.userId },
        data: { lastLoginAt: new Date() },
      });
    });
  }

  async getInvite(inviteId: string) {
    const invite = await (this.prisma as any).hospitalUserInvite.findUnique({
      where: { inviteId },
      include: { hospital: true },
    });
    if (!invite) return null;

    return {
      invite_id: invite.inviteId,
      invite_status: invite.inviteStatus,
      hospital: {
        display_name: invite.hospital.displayName,
        city: invite.hospital.city,
        state: invite.hospital.state,
      },
      email_masked: maskEmail(invite.email),
      requested_roles: invite.roleKeysRequested,
      branch_scope: branchScopeFromPayload(invite.branchScopePayload),
      expires_at: invite.expiresAt.toISOString(),
    };
  }

  async acceptInvite(
    inviteId: string,
    input: { name?: string; phone?: string | null; otp?: string },
  ) {
    const invite = await (this.prisma as any).hospitalUserInvite.findUnique({
      where: { inviteId },
    });
    if (!invite) return { status: "not_found" as const };
    if (!input.name?.trim() || input.otp !== syntheticOtp)
      return { status: "validation_error" as const };
    if (invite.inviteStatus !== "pending" || invite.expiresAt <= new Date())
      return { status: "not_accepting" as const };

    const acceptedName = input.name.trim();
    const emailNormalized = normalizeEmail(invite.email);
    const branchScope = branchScopeFromPayload(invite.branchScopePayload);
    const user = await (this.prisma as any).$transaction(async (tx: any) => {
      for (const roleKey of invite.roleKeysRequested) {
        await tx.roleLookup.upsert({
          where: { roleKey },
          update: { activeStatus: "active" },
          create: {
            roleKey,
            displayLabel: roleKey.replaceAll("_", " "),
            isInternal: roleKey === "eyther_support_admin",
          },
        });
      }

      const acceptedUser = await tx.hospitalUser.upsert({
        where: {
          tenantId_loginIdentifierEmail: {
            tenantId: invite.tenantId,
            loginIdentifierEmail: emailNormalized,
          },
        },
        update: {
          name: acceptedName,
          email: invite.email,
          phoneMasked: invite.phoneMasked ?? input.phone ?? null,
          userStatus: "active",
          deactivatedAt: null,
          deactivationReason: null,
        },
        create: {
          tenantId: invite.tenantId,
          hospitalId: invite.hospitalId,
          name: acceptedName,
          email: invite.email,
          phoneMasked: invite.phoneMasked ?? input.phone ?? null,
          loginIdentifierEmail: emailNormalized,
          userStatus: "active",
        },
      });

      for (const roleKey of invite.roleKeysRequested) {
        await tx.hospitalUserRoleAssignment.create({
          data: {
            tenantId: invite.tenantId,
            hospitalId: invite.hospitalId,
            userId: acceptedUser.userId,
            roleKey,
            assignmentStatus: "active",
          },
        });
      }

      if (branchScope.all_branches || branchScope.branch_ids.length === 0) {
        await tx.hospitalUserBranchScope.create({
          data: {
            tenantId: invite.tenantId,
            hospitalId: invite.hospitalId,
            userId: acceptedUser.userId,
            allBranches: true,
            scopeStatus: "active",
          },
        });
      } else {
        for (const branchId of branchScope.branch_ids) {
          await tx.hospitalUserBranchScope.create({
            data: {
              tenantId: invite.tenantId,
              hospitalId: invite.hospitalId,
              userId: acceptedUser.userId,
              branchId,
              allBranches: false,
              scopeStatus: "active",
            },
          });
        }
      }

      await tx.hospitalUserInvite.update({
        where: { inviteId },
        data: { inviteStatus: "accepted", acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          tenantId: invite.tenantId,
          hospitalId: invite.hospitalId,
          actorUserId: acceptedUser.userId,
          action: "user_invite_accept",
          entityType: "hospital_user_invite",
          entityId: inviteId,
          metadataRedacted: { source: "invite_accept" },
        },
      });

      return tx.hospitalUser.findUnique({
        where: { userId: acceptedUser.userId },
        include: {
          roleAssignments: { where: { assignmentStatus: "active" } },
          branchScopes: { where: { scopeStatus: "active" } },
        },
      });
    });

    if (!user) return { status: "not_accepting" as const };
    return {
      status: "accepted" as const,
      invite_id: inviteId,
      invite_status: "accepted" as const,
      session: await this.issuePrismaSession(user),
      audit_actions: ["user_invite_accept", "login"] as const,
    };
  }

  async getSessionByToken(token: string | undefined) {
    if (!token) return null;
    const session = await (this.prisma as any).authSession.findUnique({
      where: { sessionTokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: {
            roleAssignments: { where: { assignmentStatus: "active" } },
            branchScopes: { where: { scopeStatus: "active" } },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user ||
      session.user.userStatus !== "active"
    )
      return null;

    await (this.prisma as any).authSession.update({
      where: { sessionId: session.sessionId },
      data: { lastSeenAt: new Date() },
    });
    return {
      session_id: session.sessionId,
      user: userFromPrismaRecord(session.user),
      created_at: session.createdAt.toISOString(),
      expires_at: session.expiresAt.toISOString(),
      revoked_at: toIso(session.revokedAt),
      session_fresh_until:
        toIso(session.sessionFreshUntil) ?? session.expiresAt.toISOString(),
    };
  }

  async revokeSessionByToken(token: string | undefined) {
    if (!token) return false;
    const result = await (this.prisma as any).authSession.updateMany({
      where: { sessionTokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async close() {
    await this.prisma.$disconnect();
  }

  private async audit(
    action: string,
    entityType: string,
    entityId: string,
    tenantId: string | null,
    hospitalId: string | null,
    actorUserId: string | null,
  ) {
    await (this.prisma as any).auditLog.create({
      data: {
        tenantId,
        hospitalId,
        actorUserId,
        action,
        entityType,
        entityId,
        metadataRedacted: { source: "auth_store" },
      },
    });
  }

  private async issuePrismaSession(
    user: any,
    beforeCreate?: (tx: any) => Promise<void>,
  ): Promise<SessionIssue> {
    const token = randomUUID();
    const { freshUntil, expiresAt } = sessionDates();

    const sessionUser = await (this.prisma as any).$transaction(
      async (tx: any) => {
        if (beforeCreate) await beforeCreate(tx);
        await tx.authSession.create({
          data: {
            tenantId: user.tenantId,
            hospitalId: user.hospitalId,
            userId: user.userId,
            sessionTokenHash: hashSessionToken(token),
            expiresAt,
            sessionFreshUntil: freshUntil,
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId: user.tenantId,
            hospitalId: user.hospitalId,
            actorUserId: user.userId,
            action: "login",
            entityType: "hospital_user",
            entityId: user.userId,
            metadataRedacted: { source: "session_create" },
          },
        });
        return tx.hospitalUser.findUnique({
          where: { userId: user.userId },
          include: {
            roleAssignments: { where: { assignmentStatus: "active" } },
            branchScopes: { where: { scopeStatus: "active" } },
          },
        });
      },
    );

    return {
      token,
      user: userFromPrismaRecord(sessionUser),
      session_fresh_until: freshUntil.toISOString(),
    };
  }
}

export function createAuthStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AuthStore {
  if (env.EYTHER_AUTH_STORE === "prisma") {
    if (!env.DATABASE_URL)
      throw new Error("EYTHER_AUTH_STORE=prisma requires DATABASE_URL.");
    return new PrismaAuthStore(createPrismaClient());
  }

  return createInMemoryAuthStore();
}
