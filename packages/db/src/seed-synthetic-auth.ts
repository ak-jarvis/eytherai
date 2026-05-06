import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ids = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  hospitalId: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000003",
  inviteId: "00000000-0000-4000-8000-000000000004",
  branchScopeId: "00000000-0000-4000-8000-000000000005",
};

const roles = ["hospital_admin", "claim_officer", "billing_finance"];

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.authSession.deleteMany({ where: { userId: ids.userId } });
    await tx.authLoginChallenge.deleteMany({ where: { userId: ids.userId } });
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: ids.userId },
          {
            tenantId: ids.tenantId,
            hospitalId: ids.hospitalId,
            entityType: {
              in: ["auth_session", "hospital_user", "auth_login_challenge"],
            },
          },
        ],
      },
    });

    await tx.tenant.upsert({
      where: { tenantId: ids.tenantId },
      update: {
        displayName: "Lotus Valley Test Tenant",
        tenantStatus: "active",
      },
      create: {
        tenantId: ids.tenantId,
        tenantSlug: "lotus-valley-test",
        displayName: "Lotus Valley Test Tenant",
      },
    });

    await tx.hospital.upsert({
      where: { hospitalId: ids.hospitalId },
      update: {
        displayName: "Lotus Valley Test Hospital",
        activeStatus: "active",
      },
      create: {
        hospitalId: ids.hospitalId,
        tenantId: ids.tenantId,
        legalName: "Lotus Valley Test Hospital Private Limited",
        displayName: "Lotus Valley Test Hospital",
        city: "Indore",
        state: "Madhya Pradesh",
      },
    });

    for (const roleKey of roles) {
      await tx.roleLookup.upsert({
        where: { roleKey },
        update: { activeStatus: "active" },
        create: {
          roleKey,
          displayLabel: roleKey.replaceAll("_", " "),
          isInternal: false,
        },
      });
    }

    await tx.hospitalUser.upsert({
      where: { userId: ids.userId },
      update: {
        name: "Insurance Desk Test Owner",
        email: "insurance.desk@example.test",
        loginIdentifierEmail: "insurance.desk@example.test",
        userStatus: "active",
        deactivatedAt: null,
        deactivationReason: null,
      },
      create: {
        userId: ids.userId,
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        name: "Insurance Desk Test Owner",
        email: "insurance.desk@example.test",
        loginIdentifierEmail: "insurance.desk@example.test",
        userStatus: "active",
      },
    });

    await tx.hospitalUserRoleAssignment.deleteMany({
      where: {
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        userId: ids.userId,
      },
    });
    for (const [index, roleKey] of roles.entries()) {
      await tx.hospitalUserRoleAssignment.create({
        data: {
          roleAssignmentId: `00000000-0000-4000-8000-00000000010${index}`,
          tenantId: ids.tenantId,
          hospitalId: ids.hospitalId,
          userId: ids.userId,
          roleKey,
          assignmentStatus: "active",
          reasonSanitized: "Synthetic auth verifier seed",
        },
      });
    }

    await tx.hospitalUserBranchScope.deleteMany({
      where: {
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        userId: ids.userId,
      },
    });
    await tx.hospitalUserBranchScope.create({
      data: {
        branchScopeId: ids.branchScopeId,
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        userId: ids.userId,
        allBranches: true,
        scopeStatus: "active",
        reasonSanitized: "Synthetic all-branch verifier seed",
      },
    });

    await tx.hospitalUserInvite.upsert({
      where: { inviteId: ids.inviteId },
      update: {
        inviteStatus: "pending",
        acceptedAt: null,
        revokedAt: null,
        roleKeysRequested: roles,
        branchScopePayload: { all_branches: true, branch_ids: [] },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      create: {
        inviteId: ids.inviteId,
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        email: "insurance.desk@example.test",
        name: "Insurance Desk Test Owner",
        roleKeysRequested: roles,
        branchScopePayload: { all_branches: true, branch_ids: [] },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  });

  console.log(
    "Synthetic auth seed complete: tenant/hospital/user/roles/branch/invite only; no patient data.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
