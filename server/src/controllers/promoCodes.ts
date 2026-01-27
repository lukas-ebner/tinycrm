import { Request, Response } from 'express';
import pool from '../db/config.js';
import { parse } from 'csv-parse/sync';

// Get all promo code lists
export async function getPromoCodeLists(req: Request, res: Response) {
  try {
    const result = await pool.query(`
      SELECT
        pcl.*,
        COUNT(pc.id) as total_codes,
        COUNT(CASE WHEN pc.status = 'available' THEN 1 END) as available_codes,
        COUNT(CASE WHEN pc.status = 'assigned' THEN 1 END) as assigned_codes,
        COUNT(CASE WHEN pc.status = 'redeemed' THEN 1 END) as redeemed_codes
      FROM promo_code_lists pcl
      LEFT JOIN promo_codes pc ON pc.list_id = pcl.id
      GROUP BY pcl.id
      ORDER BY pcl.imported_at DESC
    `);

    res.json({ lists: result.rows });
  } catch (error: any) {
    console.error('Get promo code lists error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get all promo codes with filters
export async function getPromoCodes(req: Request, res: Response) {
  try {
    const { list_id, status } = req.query;

    let query = `
      SELECT
        pc.*,
        pcl.name as list_name,
        l.name as lead_name,
        l.id as lead_id
      FROM promo_codes pc
      LEFT JOIN promo_code_lists pcl ON pc.list_id = pcl.id
      LEFT JOIN leads l ON pc.assigned_to_lead_id = l.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (list_id) {
      query += ` AND pc.list_id = $${paramIndex}`;
      params.push(list_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND pc.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ' ORDER BY pc.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ codes: result.rows });
  } catch (error: any) {
    console.error('Get promo codes error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Import promo codes from CSV
export async function importPromoCodes(req: Request, res: Response) {
  const client = await pool.connect();

  try {
    const { name, csv_content } = req.body;

    if (!name || !csv_content) {
      return res.status(400).json({ error: 'Name and CSV content required' });
    }

    // Parse CSV
    const records = parse(csv_content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'No codes found in CSV' });
    }

    await client.query('BEGIN');

    // Create promo code list
    const listResult = await client.query(
      'INSERT INTO promo_code_lists (name, total_codes) VALUES ($1, $2) RETURNING *',
      [name, records.length]
    );

    const list = listResult.rows[0];

    // Insert all codes
    for (const record of records) {
      await client.query(`
        INSERT INTO promo_codes (
          list_id, code, promotion_code_id, active,
          max_redemptions, times_redeemed, expires_at, created, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        list.id,
        record.code,
        record.promotion_code_id,
        record.active === 'true',
        parseInt(record.max_redemptions) || 1,
        parseInt(record.times_redeemed) || 0,
        record.expires_at ? parseInt(record.expires_at) : null,
        record.created ? parseInt(record.created) : null,
        'available'
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      list,
      imported_count: records.length
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Import promo codes error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}

// Assign promo code to lead
export async function assignPromoCodeToLead(req: Request, res: Response) {
  const client = await pool.connect();

  try {
    const { lead_id } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: 'Lead ID required' });
    }

    await client.query('BEGIN');

    // Check if lead already has a code
    const existingCode = await client.query(
      'SELECT * FROM promo_codes WHERE assigned_to_lead_id = $1',
      [lead_id]
    );

    if (existingCode.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lead already has a promo code assigned' });
    }

    // Get next available code (oldest first)
    const availableCode = await client.query(`
      SELECT * FROM promo_codes
      WHERE status = 'available'
      ORDER BY created_at ASC
      LIMIT 1
    `);

    if (availableCode.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No codes available' });
    }

    const code = availableCode.rows[0];

    // Assign code to lead
    const result = await client.query(`
      UPDATE promo_codes
      SET assigned_to_lead_id = $1, assigned_at = NOW(), status = 'assigned'
      WHERE id = $2
      RETURNING *
    `, [lead_id, code.id]);

    await client.query('COMMIT');

    res.json({ code: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Assign promo code error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}

// Unassign promo code from lead
export async function unassignPromoCode(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE promo_codes
      SET assigned_to_lead_id = NULL, assigned_at = NULL, status = 'available'
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    res.json({ code: result.rows[0] });
  } catch (error: any) {
    console.error('Unassign promo code error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get promo code for a specific lead
export async function getPromoCodeForLead(req: Request, res: Response) {
  try {
    const { lead_id } = req.params;

    const result = await pool.query(`
      SELECT pc.*, pcl.name as list_name
      FROM promo_codes pc
      LEFT JOIN promo_code_lists pcl ON pc.list_id = pcl.id
      WHERE pc.assigned_to_lead_id = $1
    `, [lead_id]);

    res.json({ code: result.rows[0] || null });
  } catch (error: any) {
    console.error('Get promo code for lead error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Mark code as redeemed (for future webhook integration)
export async function markCodeAsRedeemed(req: Request, res: Response) {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code required' });
    }

    const result = await pool.query(`
      UPDATE promo_codes
      SET status = 'redeemed', times_redeemed = times_redeemed + 1
      WHERE code = $1
      RETURNING *
    `, [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }

    res.json({ code: result.rows[0] });
  } catch (error: any) {
    console.error('Mark code as redeemed error:', error);
    res.status(500).json({ error: error.message });
  }
}
