import { Request, Response } from 'express';
import { getLeadtimePool } from '../db/leadtimeConfig.js';

export async function getWorkspaceStatus(req: Request, res: Response) {
  try {
    const { code } = req.query;

    // Validation
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Query parameter "code" is required'
      });
    }

    const pool = getLeadtimePool();

    // Single optimized query with CTEs
    const result = await pool.query(`
      WITH latest_workspace AS (
        -- Find most recent workspace for this promo code
        SELECT
          w.id,
          w."companyName" as name,
          w."createdAt"
        FROM "SignInSession" sis
        JOIN "Workspace" w ON sis."workspaceId" = w.id
        WHERE
          sis."promotionCode" = $1
          AND sis."completedAt" IS NOT NULL
        ORDER BY w."createdAt" DESC
        LIMIT 1
      ),
      root_user AS (
        -- Find root user (first user created in workspace)
        SELECT
          u.id,
          u.email,
          u."firstName",
          u."lastName",
          u."workspaceId"
        FROM latest_workspace lw
        JOIN "User" u ON u."workspaceId" = lw.id
        ORDER BY u."createdAt" ASC
        LIMIT 1
      ),
      login_info AS (
        -- Check if root user has logged in
        SELECT
          MAX(ws."lastSeenAt") as "lastSeenAt",
          COUNT(*) as login_count
        FROM root_user ru
        JOIN "WebSession" ws ON ws."userId" = ru.id AND ws."workspaceId" = ru."workspaceId"
        WHERE ws."revokedAt" IS NULL
      )
      SELECT
        lw.id as workspace_id,
        lw.name as workspace_name,
        lw."createdAt" as workspace_created_at,
        ru.email as root_user_email,
        ru."firstName" as root_user_first_name,
        ru."lastName" as root_user_last_name,
        li."lastSeenAt" as last_login_at,
        CASE WHEN li.login_count > 0 THEN true ELSE false END as has_logged_in
      FROM latest_workspace lw
      LEFT JOIN root_user ru ON true
      LEFT JOIN login_info li ON true
    `, [code]);

    // Handle no workspace found
    if (result.rows.length === 0) {
      return res.json({
        found: false,
        workspace: null
      });
    }

    const row = result.rows[0];

    // Format response
    res.json({
      found: true,
      workspace: {
        id: row.workspace_id,
        name: row.workspace_name,
        createdAt: row.workspace_created_at,
        rootUserEmail: row.root_user_email,
        rootUserName: row.root_user_first_name && row.root_user_last_name
          ? `${row.root_user_first_name} ${row.root_user_last_name}`
          : null,
        rootUserHasLoggedIn: row.has_logged_in || false,
        lastLoginAt: row.last_login_at
      }
    });
  } catch (error: any) {
    console.error('Get workspace status error:', error);

    // Differentiate between connection errors and query errors
    if (error.message?.includes('LT_DB_READONLY_CONNECTION_STRING')) {
      return res.status(503).json({
        error: 'Workspace status service not configured'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch workspace status',
      details: error.message
    });
  }
}
