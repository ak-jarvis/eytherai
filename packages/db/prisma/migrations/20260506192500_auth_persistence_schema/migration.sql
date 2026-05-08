-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'deactivated', 'revoked');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('active', 'inactive', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('hospital_user', 'eyther_support_admin', 'system', 'integration');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('login', 'failed_login', 'logout', 'forbidden_access', 'user_invite_create', 'user_invite_accept', 'user_invite_revoke', 'user_deactivate', 'user_reactivate', 'role_change', 'branch_scope_change');

-- CreateTable
CREATE TABLE "Tenant" (
    "tenantId" UUID NOT NULL,
    "tenantSlug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tenantStatus" TEXT NOT NULL DEFAULT 'active',
    "dataRegion" TEXT NOT NULL DEFAULT 'railway-cloud-pilot',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "hospitalId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "branchUnitName" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("hospitalId")
);

-- CreateTable
CREATE TABLE "HospitalUser" (
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneMasked" TEXT,
    "loginIdentifierEmail" TEXT NOT NULL,
    "userStatus" "UserStatus" NOT NULL DEFAULT 'invited',
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedByUserId" UUID,
    "deactivationReason" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalUser_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RoleLookup" (
    "roleKey" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleLookup_pkey" PRIMARY KEY ("roleKey")
);

-- CreateTable
CREATE TABLE "HospitalUserRoleAssignment" (
    "roleAssignmentId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleKey" TEXT NOT NULL,
    "assignmentStatus" "AssignmentStatus" NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "assignedByUserId" UUID,
    "reasonSanitized" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalUserRoleAssignment_pkey" PRIMARY KEY ("roleAssignmentId")
);

-- CreateTable
CREATE TABLE "HospitalUserBranchScope" (
    "branchScopeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "branchId" UUID,
    "allBranches" BOOLEAN NOT NULL DEFAULT false,
    "scopeStatus" "AssignmentStatus" NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "assignedByUserId" UUID,
    "reasonSanitized" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalUserBranchScope_pkey" PRIMARY KEY ("branchScopeId")
);

-- CreateTable
CREATE TABLE "HospitalUserInvite" (
    "inviteId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneMasked" TEXT,
    "roleKeysRequested" TEXT[],
    "branchScopePayload" JSONB NOT NULL,
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedByUserId" UUID,
    "revokedByUserId" UUID,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalUserInvite_pkey" PRIMARY KEY ("inviteId")
);

-- CreateTable
CREATE TABLE "AuthLoginChallenge" (
    "loginChallengeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "userId" UUID,
    "emailNormalized" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "delivery" TEXT NOT NULL DEFAULT 'synthetic_email',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLoginChallenge_pkey" PRIMARY KEY ("loginChallengeId")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "sessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "ipContextHash" TEXT,
    "deviceContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "sessionFreshUntil" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "auditLogId" UUID NOT NULL,
    "tenantId" UUID,
    "hospitalId" UUID,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'hospital_user',
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadataRedacted" JSONB NOT NULL DEFAULT '{}',
    "reasonSanitized" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("auditLogId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_tenantSlug_key" ON "Tenant"("tenantSlug");

-- CreateIndex
CREATE INDEX "Hospital_tenantId_idx" ON "Hospital"("tenantId");

-- CreateIndex
CREATE INDEX "HospitalUser_tenantId_hospitalId_idx" ON "HospitalUser"("tenantId", "hospitalId");

-- CreateIndex
CREATE INDEX "HospitalUser_email_idx" ON "HospitalUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalUser_tenantId_loginIdentifierEmail_key" ON "HospitalUser"("tenantId", "loginIdentifierEmail");

-- CreateIndex
CREATE INDEX "HospitalUserRoleAssignment_tenantId_hospitalId_userId_idx" ON "HospitalUserRoleAssignment"("tenantId", "hospitalId", "userId");

-- CreateIndex
CREATE INDEX "HospitalUserRoleAssignment_roleKey_idx" ON "HospitalUserRoleAssignment"("roleKey");

-- CreateIndex
CREATE INDEX "HospitalUserBranchScope_tenantId_hospitalId_userId_idx" ON "HospitalUserBranchScope"("tenantId", "hospitalId", "userId");

-- CreateIndex
CREATE INDEX "HospitalUserInvite_tenantId_hospitalId_email_idx" ON "HospitalUserInvite"("tenantId", "hospitalId", "email");

-- CreateIndex
CREATE INDEX "HospitalUserInvite_inviteStatus_idx" ON "HospitalUserInvite"("inviteStatus");

-- CreateIndex
CREATE INDEX "AuthLoginChallenge_emailNormalized_expiresAt_idx" ON "AuthLoginChallenge"("emailNormalized", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthLoginChallenge_tenantId_hospitalId_idx" ON "AuthLoginChallenge"("tenantId", "hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_sessionTokenHash_key" ON "AuthSession"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_tenantId_hospitalId_userId_idx" ON "AuthSession"("tenantId", "hospitalId", "userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_hospitalId_createdAt_idx" ON "AuditLog"("tenantId", "hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUser" ADD CONSTRAINT "HospitalUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUser" ADD CONSTRAINT "HospitalUser_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserRoleAssignment" ADD CONSTRAINT "HospitalUserRoleAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserRoleAssignment" ADD CONSTRAINT "HospitalUserRoleAssignment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserRoleAssignment" ADD CONSTRAINT "HospitalUserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HospitalUser"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserRoleAssignment" ADD CONSTRAINT "HospitalUserRoleAssignment_roleKey_fkey" FOREIGN KEY ("roleKey") REFERENCES "RoleLookup"("roleKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserBranchScope" ADD CONSTRAINT "HospitalUserBranchScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserBranchScope" ADD CONSTRAINT "HospitalUserBranchScope_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserBranchScope" ADD CONSTRAINT "HospitalUserBranchScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HospitalUser"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserInvite" ADD CONSTRAINT "HospitalUserInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalUserInvite" ADD CONSTRAINT "HospitalUserInvite_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthLoginChallenge" ADD CONSTRAINT "AuthLoginChallenge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthLoginChallenge" ADD CONSTRAINT "AuthLoginChallenge_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthLoginChallenge" ADD CONSTRAINT "AuthLoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HospitalUser"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HospitalUser"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE SET NULL ON UPDATE CASCADE;
