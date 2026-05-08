import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const userId = "00000000-0000-4000-8000-000000000003";

async function main() {
  const user = await prisma.hospitalUser.findUnique({
    where: { userId },
    include: {
      roleAssignments: { where: { assignmentStatus: "active" } },
      branchScopes: { where: { scopeStatus: "active" } },
      sessions: true,
    },
  });

  if (!user || user.userStatus !== "active")
    throw new Error("Synthetic active hospital user was not found.");
  if (!user.roleAssignments.some((role) => role.roleKey === "claim_officer"))
    throw new Error("Synthetic claim_officer role was not found.");
  if (!user.branchScopes.some((scope) => scope.allBranches))
    throw new Error("Synthetic all-branch scope was not found.");
  if (!user.sessions.some((session) => session.revokedAt))
    throw new Error("No revoked DB auth session found after logout.");

  const challenges = await prisma.authLoginChallenge.findMany({
    where: { userId },
  });
  if (!challenges.some((challenge) => challenge.consumedAt))
    throw new Error("No consumed DB login challenge found.");
  if (!challenges.every((challenge) => challenge.otpHash.length === 64))
    throw new Error("Login challenge OTP hash evidence is malformed.");

  const sessions = await prisma.authSession.findMany({ where: { userId } });
  if (!sessions.every((session) => session.sessionTokenHash.length === 64))
    throw new Error("Session token hash evidence is malformed.");

  const auditActions = new Set(
    (
      await prisma.auditLog.findMany({
        where: { actorUserId: userId },
        select: { action: true },
      })
    ).map((entry) => entry.action),
  );
  for (const action of ["failed_login", "login", "logout"]) {
    if (!auditActions.has(action as never))
      throw new Error(`Missing DB audit action: ${action}`);
  }

  console.log(
    "Synthetic DB auth evidence OK: active user, roles, branch scope, consumed challenge, revoked session, failed-login/login/logout audit.",
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
