import { expect, test, type APIRequestContext } from "@playwright/test";
import { accessHeaders, adminApiUrl, requiredEnvironment } from "./support";

interface ServiceSession {
  identityId: string;
  permissions: string[];
  principalKind: "service";
  serviceName: string;
}

interface Invitation {
  id: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  version: number;
}

async function auditEvents(
  request: APIRequestContext,
  session: ServiceSession,
  action: string,
  headers: ReturnType<typeof accessHeaders>,
) {
  const query = new URLSearchParams({
    action,
    actorId: session.identityId,
    pageSize: "25",
    targetType: "admin_invitation",
  });
  const response = await request.get(adminApiUrl(`/admin/audit?${query}`), {
    headers,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    data: Array<{ actorType: string; result: string; targetId: string | null }>;
  };
}

test("service principal is mapped, auditable, and cannot change a human password", async ({
  request,
}) => {
  const headers = accessHeaders();
  const proofId = requiredEnvironment("E2E_ADMIN_ACCESS_PROOF_ID");
  const proofEmail = requiredEnvironment("E2E_ADMIN_ACCESS_PROOF_EMAIL");

  const sessionResponse = await request.get(adminApiUrl("/admin/session"), { headers });
  expect(sessionResponse.ok()).toBeTruthy();
  const session = ((await sessionResponse.json()) as { data: ServiceSession }).data;
  expect(session).toMatchObject({ principalKind: "service" });
  expect(session.serviceName).toBeTruthy();
  expect(session.permissions).toEqual(
    expect.arrayContaining(["audit.read", "iam.users.read", "iam.users.write"]),
  );

  const usersResponse = await request.get(adminApiUrl("/admin/iam/users?pageSize=100"), {
    headers,
  });
  expect(usersResponse.ok()).toBeTruthy();
  const users = (await usersResponse.json()) as { data: { items: Array<{ id: string }> } };
  expect(users.data.items.some(({ id }) => id === session.identityId)).toBe(false);

  const passwordResponse = await request.post(adminApiUrl("/admin/auth/password/change"), {
    data: {
      currentPassword: "not-a-human-password",
      newPassword: "another-not-human-password",
    },
    headers,
  });
  expect(passwordResponse.status()).toBe(403);
  expect(await passwordResponse.json()).toMatchObject({
    error: { code: "human_password_required" },
  });

  const invitationsResponse = await request.get(
    adminApiUrl(`/admin/iam/invitations?search=${encodeURIComponent(proofEmail)}&pageSize=10`),
    {
      headers,
    },
  );
  expect(invitationsResponse.ok()).toBeTruthy();
  const invitations = (await invitationsResponse.json()) as {
    data: { items: Invitation[] };
  };
  const invitationId = `inv_${proofId}`;
  let invitation = invitations.data.items.find(({ id }) => id === invitationId);
  if (!invitation) throw new Error(`Release proof invitation ${invitationId} is missing.`);

  if (invitation.status === "pending") {
    const revokeResponse = await request.post(
      adminApiUrl(`/admin/iam/invitations/${encodeURIComponent(invitation.id)}/revoke`),
      {
        data: { expectedVersion: invitation.version },
        headers,
      },
    );
    expect(revokeResponse.ok()).toBeTruthy();
    invitation = ((await revokeResponse.json()) as { data: Invitation }).data;
  }
  expect(invitation.status).toBe("revoked");

  const revoked = await auditEvents(request, session, "iam.invitations.revoke", headers);
  expect(revoked.data).toContainEqual(
    expect.objectContaining({
      actorType: "machine",
      result: "succeeded",
      targetId: invitation.id,
    }),
  );
});
