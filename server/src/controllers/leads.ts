import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

export const getAllLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { stage_id, assigned_to, tag, tags, search, nace_code, city, zip, min_score, import_source } = req.query;

    let query = `
      SELECT
        l.*,
        s.name as stage_name,
        s.color as stage_color,
        u.name as assigned_to_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', t.id, 'name', t.name)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags
      FROM leads l
      LEFT JOIN stages s ON l.stage_id = s.id
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN lead_tags lt ON l.id = lt.lead_id
      LEFT JOIN tags t ON lt.tag_id = t.id
    `;

    const conditions: string[] = [];
    const havingConditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Role-based access: callers only see their assigned leads
    if (req.user?.role === 'caller') {
      conditions.push(`l.assigned_to = $${paramCount++}`);
      values.push(req.user.id);
    }

    // Filters
    if (stage_id) {
      conditions.push(`l.stage_id = $${paramCount++}`);
      values.push(stage_id);
    }

    if (assigned_to) {
      conditions.push(`l.assigned_to = $${paramCount++}`);
      values.push(assigned_to);
    }

    // NACE code filter (prefix match)
    if (nace_code) {
      conditions.push(`l.nace_code ILIKE $${paramCount++}`);
      values.push(`${nace_code}%`);
    }

    // City filter
    if (city) {
      conditions.push(`l.city ILIKE $${paramCount++}`);
      values.push(`%${city}%`);
    }

    // ZIP filter (exact match)
    if (zip) {
      conditions.push(`l.zip = $${paramCount++}`);
      values.push(zip);
    }

    // Score filter (minimum suitability_score from enrichment_data JSONB)
    if (min_score) {
      conditions.push(`(l.enrichment_data->>'suitability_score')::int >= $${paramCount++}`);
      values.push(parseInt(min_score as string));
    }

    // Import source filter
    if (import_source) {
      conditions.push(`l.import_source = $${paramCount++}`);
      values.push(import_source);
    }

    // Multi-tag filter (AND logic - lead must have ALL specified tags)
    if (tags && typeof tags === 'string') {
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      if (tagArray.length > 0) {
        tagArray.forEach((tagName) => {
          const param = `$${paramCount++}`;
          values.push(`%${tagName}%`);
          havingConditions.push(`SUM(CASE WHEN t.name ILIKE ${param} THEN 1 ELSE 0 END) > 0`);
        });
      }
    }
    // Single tag filter (backward compatibility)
    else if (tag) {
      conditions.push(`t.name ILIKE $${paramCount++}`);
      values.push(`%${tag}%`);
    }

    // General search filter
    if (search) {
      conditions.push(`(
        l.name ILIKE $${paramCount} OR
        l.city ILIKE $${paramCount} OR
        l.nace_code ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY l.id, s.name, s.color, u.name';

    if (havingConditions.length > 0) {
      query += ' HAVING ' + havingConditions.join(' AND ');
    }

    query += ' ORDER BY l.updated_at DESC';

    const result = await pool.query(query, values);

    // Get total count (without filters except role-based access)
    let totalQuery = 'SELECT COUNT(*) as total FROM leads l';
    const totalValues: any[] = [];

    if (req.user?.role === 'caller') {
      totalQuery += ' WHERE l.assigned_to = $1';
      totalValues.push(req.user.id);
    }

    const totalResult = await pool.query(totalQuery, totalValues);
    const total = parseInt(totalResult.rows[0].total);

    res.json({
      leads: result.rows,
      total: total,
      filtered: result.rows.length
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

export const getLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        l.*,
        s.name as stage_name,
        s.color as stage_color,
        u.name as assigned_to_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', t.id, 'name', t.name)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id', n.id,
              'content', n.content,
              'user_name', un.name,
              'created_at', n.created_at
            )
            ORDER BY n.created_at DESC
          ) FILTER (WHERE n.id IS NOT NULL),
          '[]'
        ) as notes,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id', r.id,
              'due_at', r.due_at,
              'reason', r.reason,
              'completed', r.completed,
              'created_at', r.created_at
            )
            ORDER BY r.due_at ASC
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as reminders
      FROM leads l
      LEFT JOIN stages s ON l.stage_id = s.id
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN lead_tags lt ON l.id = lt.lead_id
      LEFT JOIN tags t ON lt.tag_id = t.id
      LEFT JOIN notes n ON l.id = n.lead_id
      LEFT JOIN users un ON n.user_id = un.id
      LEFT JOIN reminders r ON l.id = r.lead_id
      WHERE l.id = $1
      GROUP BY l.id, s.name, s.color, u.name
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = result.rows[0];

    // Check access: callers can only see their assigned leads
    if (req.user?.role === 'caller' && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ lead });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

export const createLead = async (req: AuthRequest, res: Response) => {
  try {
    const {
      register_id,
      name,
      legal_form,
      zip,
      city,
      street,
      phone,
      email,
      website,
      nace_code,
      business_purpose,
      ceo_1,
      ceo_2,
      revenue_eur,
      employee_count,
      northdata_url,
      stage_id,
      assigned_to,
      custom_fields = {},
      tags = []
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert lead
      const leadResult = await client.query(
        `INSERT INTO leads (
          register_id, name, legal_form, zip, city, street, phone, email,
          website, nace_code, business_purpose, ceo_1, ceo_2, revenue_eur,
          employee_count, northdata_url, stage_id, assigned_to, custom_fields
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          register_id, name, legal_form, zip, city, street, phone, email,
          website, nace_code, business_purpose, ceo_1, ceo_2, revenue_eur,
          employee_count, northdata_url, stage_id, assigned_to, JSON.stringify(custom_fields)
        ]
      );

      const lead = leadResult.rows[0];

      // Add tags if provided
      if (tags.length > 0) {
        for (const tagName of tags) {
          // Get or create tag
          const tagResult = await client.query(
            'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id',
            [tagName]
          );

          const tagId = tagResult.rows[0].id;

          // Link tag to lead
          await client.query(
            'INSERT INTO lead_tags (lead_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [lead.id, tagId]
          );
        }
      }

      await client.query('COMMIT');

      res.status(201).json({ lead });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      legal_form,
      zip,
      city,
      street,
      phone,
      email,
      website,
      nace_code,
      business_purpose,
      ceo_1,
      ceo_2,
      revenue_eur,
      employee_count,
      northdata_url,
      stage_id,
      assigned_to,
      custom_fields,
      tags
    } = req.body;

    // Check access
    if (req.user?.role === 'caller') {
      const accessCheck = await pool.query(
        'SELECT assigned_to FROM leads WHERE id = $1',
        [id]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      if (accessCheck.rows[0].assigned_to !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
      if (legal_form !== undefined) { updates.push(`legal_form = $${paramCount++}`); values.push(legal_form); }
      if (zip !== undefined) { updates.push(`zip = $${paramCount++}`); values.push(zip); }
      if (city !== undefined) { updates.push(`city = $${paramCount++}`); values.push(city); }
      if (street !== undefined) { updates.push(`street = $${paramCount++}`); values.push(street); }
      if (phone !== undefined) { updates.push(`phone = $${paramCount++}`); values.push(phone); }
      if (email !== undefined) { updates.push(`email = $${paramCount++}`); values.push(email); }
      if (website !== undefined) { updates.push(`website = $${paramCount++}`); values.push(website); }
      if (nace_code !== undefined) { updates.push(`nace_code = $${paramCount++}`); values.push(nace_code); }
      if (business_purpose !== undefined) { updates.push(`business_purpose = $${paramCount++}`); values.push(business_purpose); }
      if (ceo_1 !== undefined) { updates.push(`ceo_1 = $${paramCount++}`); values.push(ceo_1); }
      if (ceo_2 !== undefined) { updates.push(`ceo_2 = $${paramCount++}`); values.push(ceo_2); }
      if (revenue_eur !== undefined) { updates.push(`revenue_eur = $${paramCount++}`); values.push(revenue_eur); }
      if (employee_count !== undefined) { updates.push(`employee_count = $${paramCount++}`); values.push(employee_count); }
      if (northdata_url !== undefined) { updates.push(`northdata_url = $${paramCount++}`); values.push(northdata_url); }
      if (stage_id !== undefined) { updates.push(`stage_id = $${paramCount++}`); values.push(stage_id); }
      if (assigned_to !== undefined) { updates.push(`assigned_to = $${paramCount++}`); values.push(assigned_to); }
      if (custom_fields !== undefined) { updates.push(`custom_fields = $${paramCount++}`); values.push(JSON.stringify(custom_fields)); }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      if (updates.length === 1) { // Only updated_at
        return res.status(400).json({ error: 'No fields to update' });
      }

      const result = await client.query(
        `UPDATE leads SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Update tags if provided
      if (tags !== undefined) {
        // Remove existing tags
        await client.query('DELETE FROM lead_tags WHERE lead_id = $1', [id]);

        // Add new tags
        if (tags.length > 0) {
          for (const tagName of tags) {
            const tagResult = await client.query(
              'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id',
              [tagName]
            );

            const tagId = tagResult.rows[0].id;

            await client.query(
              'INSERT INTO lead_tags (lead_id, tag_id) VALUES ($1, $2)',
              [id, tagId]
            );
          }
        }
      }

      await client.query('COMMIT');

      res.json({ lead: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

export const deleteLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Only admins can delete leads
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

export const bulkAssignLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_ids, assigned_to } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids array is required' });
    }

    // Only admins can bulk assign
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      'UPDATE leads SET assigned_to = $1, updated_at = NOW() WHERE id = ANY($2) RETURNING id',
      [assigned_to, lead_ids]
    );

    res.json({
      message: `${result.rows.length} leads assigned successfully`,
      updated: result.rows.length
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ error: 'Failed to assign leads' });
  }
};

// Bulk assign leads from saved filter
export const bulkAssignFromFilter = async (req: AuthRequest, res: Response) => {
  try {
    // Only admins can bulk assign
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { filter_id, assigned_to } = req.body;

    if (!filter_id || !assigned_to) {
      return res.status(400).json({ error: 'filter_id and assigned_to are required' });
    }

    // Fetch the saved filter
    const filterResult = await pool.query(
      'SELECT * FROM saved_filters WHERE id = $1 AND user_id = $2',
      [filter_id, req.user.id]
    );

    if (filterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    const filter = filterResult.rows[0];

    // Build query to fetch lead IDs matching the filter
    let query = `SELECT l.id FROM leads l`;

    // Add JOINs if needed for tags
    if (filter.tags && filter.tags.length > 0) {
      query += `
        LEFT JOIN lead_tags lt ON l.id = lt.lead_id
        LEFT JOIN tags t ON lt.tag_id = t.id
      `;
    }

    const conditions: string[] = [];
    const havingConditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Apply filter conditions
    if (filter.stage_id) {
      conditions.push(`l.stage_id = $${paramCount++}`);
      values.push(filter.stage_id);
    }

    if (filter.assigned_to) {
      conditions.push(`l.assigned_to = $${paramCount++}`);
      values.push(filter.assigned_to);
    }

    if (filter.nace_code) {
      conditions.push(`l.nace_code ILIKE $${paramCount++}`);
      values.push(`${filter.nace_code}%`);
    }

    if (filter.city) {
      conditions.push(`l.city ILIKE $${paramCount++}`);
      values.push(`%${filter.city}%`);
    }

    if (filter.zip) {
      conditions.push(`l.zip = $${paramCount++}`);
      values.push(filter.zip);
    }

    if (filter.search) {
      conditions.push(`(
        l.name ILIKE $${paramCount} OR
        l.city ILIKE $${paramCount} OR
        l.nace_code ILIKE $${paramCount}
      )`);
      values.push(`%${filter.search}%`);
      paramCount++;
    }

    // Multi-tag filter
    if (filter.tags && filter.tags.length > 0) {
      const tagArray = typeof filter.tags === 'string'
        ? JSON.parse(filter.tags)
        : filter.tags;

      if (tagArray.length > 0) {
        tagArray.forEach((tagName: string) => {
          const param = `$${paramCount++}`;
          values.push(`%${tagName}%`);
          havingConditions.push(`SUM(CASE WHEN t.name ILIKE ${param} THEN 1 ELSE 0 END) > 0`);
        });
      }
    }

    // Score filter (minimum suitability_score from enrichment_data JSONB)
    if (filter.min_score) {
      conditions.push(`(l.enrichment_data->>'suitability_score')::int >= $${paramCount++}`);
      values.push(filter.min_score);
    }

    // Import source filter
    if (filter.import_source) {
      conditions.push(`l.import_source = $${paramCount++}`);
      values.push(filter.import_source);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    if (filter.tags && filter.tags.length > 0) {
      query += ' GROUP BY l.id';
      if (havingConditions.length > 0) {
        query += ' HAVING ' + havingConditions.join(' AND ');
      }
    }

    // Add hard limit
    query += ' LIMIT 5000';

    const leadIdsResult = await pool.query(query, values);
    const leadIds = leadIdsResult.rows.map(row => row.id);

    if (leadIds.length === 0) {
      return res.json({
        message: 'No leads match this filter',
        updated: 0
      });
    }

    if (leadIds.length > 5000) {
      return res.status(400).json({
        error: 'Too many leads to assign at once (max 5000)',
        count: leadIds.length
      });
    }

    // Perform bulk assignment
    const result = await pool.query(
      'UPDATE leads SET assigned_to = $1, updated_at = NOW() WHERE id = ANY($2) RETURNING id',
      [assigned_to, leadIds]
    );

    res.json({
      message: `${result.rows.length} leads assigned successfully`,
      updated: result.rows.length,
      lead_ids: leadIds
    });
  } catch (error) {
    console.error('Bulk assign from filter error:', error);
    res.status(500).json({ error: 'Failed to assign leads' });
  }
};

// Add tag to lead
export const addTagToLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tag_id } = req.body;

    if (!tag_id) {
      return res.status(400).json({ error: 'tag_id is required' });
    }

    // Check if lead exists and user has access
    const leadCheck = await pool.query('SELECT id, assigned_to FROM leads WHERE id = $1', [id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (req.user?.role === 'caller' && leadCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add tag to lead
    await pool.query(
      'INSERT INTO lead_tags (lead_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, tag_id]
    );

    res.json({ message: 'Tag added successfully' });
  } catch (error) {
    console.error('Add tag error:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
};

// Remove tag from lead
export const removeTagFromLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id, tag_id } = req.params;

    // Check if lead exists and user has access
    const leadCheck = await pool.query('SELECT id, assigned_to FROM leads WHERE id = $1', [id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (req.user?.role === 'caller' && leadCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove tag from lead
    await pool.query('DELETE FROM lead_tags WHERE lead_id = $1 AND tag_id = $2', [id, tag_id]);

    res.json({ message: 'Tag removed successfully' });
  } catch (error) {
    console.error('Remove tag error:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
};
