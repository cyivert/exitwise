import sql from "../../database/db";

// Aggregate the data shown on an organization admin's dashboard:
// the org row, member roster, and all transfer engagements.
export async function getOrganizationAdminContext(userId: string) {
  const [adminUser] = (await sql`
    SELECT id, org_id FROM users WHERE id = ${userId}
  `) as Array<{ id: string; org_id: string }>;

  if (!adminUser) return null;

  const [organization] = await sql`
    SELECT * FROM organizations WHERE id = ${adminUser.org_id}
  `;

  const members = await sql`
    SELECT id, org_id, email, full_name, role, job_title, years_exp, created_at
    FROM users
    WHERE org_id = ${adminUser.org_id}
    ORDER BY created_at DESC
  `;

  const experiences = await sql`
    SELECT e.*, u.full_name AS retiree_name, u.email AS retiree_email, u.job_title AS retiree_job_title
    FROM transfer_engagements e
    JOIN users u ON u.id = e.retiree_id
    WHERE e.org_id = ${adminUser.org_id}
    ORDER BY e.created_at DESC
  `;

  return { organization, members, experiences };
}
