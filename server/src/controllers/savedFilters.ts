import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

// Get all saved filters for the current user (own + assigned to them)
export const getUserFilters = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    console.log('Fetching filters for user:', userId);
    
    // Check if new columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'saved_filters' AND column_name IN ('for_user_id', 'is_shared')
    `);
    const hasNewColumns = columnsCheck.rows.length === 2;
    console.log('Has new columns (for_user_id, is_shared):', hasNewColumns);
    
    let result;
    if (hasNewColumns) {
      // Show filters that:
      // 1. User created themselves
      // 2. Were assigned to this user by an admin (for_user_id)
      // 3. Are marked as shared (is_shared = true)
      result = await pool.query(
        `SELECT sf.*, u.name as created_by_name 
         FROM saved_filters sf
         LEFT JOIN users u ON sf.user_id = u.id
         WHERE sf.user_id = $1 
            OR sf.for_user_id = $1 
            OR sf.is_shared = true
         ORDER BY sf.name ASC`,
        [userId]
      );
    } else {
      // Fallback: show all filters (old behavior + all shared)
      result = await pool.query(
        `SELECT sf.*, u.name as created_by_name 
         FROM saved_filters sf
         LEFT JOIN users u ON sf.user_id = u.id
         ORDER BY sf.name ASC`
      );
    }
    
    console.log('Found filters:', result.rows.length, 'for user:', userId);
    res.json({ filters: result.rows });
  } catch (error) {
    console.error('Get saved filters error:', error);
    res.status(500).json({ error: 'Failed to fetch saved filters' });
  }
};

// Create a new saved filter
export const createFilter = async (req: AuthRequest, res: Response) => {
  try {
    const { name, search, stage_id, nace_code, assigned_to, tags, city, zip, min_score, import_source, for_user_id, is_shared } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate tags is array if provided
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    // Only admins can create filters for other users or shared filters
    if ((for_user_id || is_shared) && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can assign filters to users or share them' });
    }

    const result = await pool.query(
      `INSERT INTO saved_filters
       (user_id, name, search, stage_id, nace_code, assigned_to, tags, city, zip, min_score, import_source, for_user_id, is_shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        req.user?.id,
        name,
        search || null,
        stage_id || null,
        nace_code || null,
        assigned_to || null,
        tags ? JSON.stringify(tags) : '[]',
        city || null,
        zip || null,
        min_score || null,
        import_source || null,
        for_user_id || null,
        is_shared || false
      ]
    );

    res.status(201).json({ filter: result.rows[0] });
  } catch (error) {
    console.error('Create saved filter error:', error);
    res.status(500).json({ error: 'Failed to create saved filter' });
  }
};

// Update a saved filter
export const updateFilter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, search, stage_id, nace_code, assigned_to, tags, city, zip, min_score, import_source, for_user_id, is_shared } = req.body;

    // Check ownership (admins can edit any filter)
    const filterCheck = await pool.query(
      'SELECT id, user_id FROM saved_filters WHERE id = $1',
      [id]
    );

    if (filterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    if (filterCheck.rows[0].user_id !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate tags if provided
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (search !== undefined) { updates.push(`search = $${paramCount++}`); values.push(search); }
    if (stage_id !== undefined) { updates.push(`stage_id = $${paramCount++}`); values.push(stage_id); }
    if (nace_code !== undefined) { updates.push(`nace_code = $${paramCount++}`); values.push(nace_code); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${paramCount++}`); values.push(assigned_to); }
    if (tags !== undefined) { updates.push(`tags = $${paramCount++}`); values.push(JSON.stringify(tags)); }
    if (city !== undefined) { updates.push(`city = $${paramCount++}`); values.push(city); }
    if (zip !== undefined) { updates.push(`zip = $${paramCount++}`); values.push(zip); }
    if (min_score !== undefined) { updates.push(`min_score = $${paramCount++}`); values.push(min_score); }
    if (import_source !== undefined) { updates.push(`import_source = $${paramCount++}`); values.push(import_source); }
    if (for_user_id !== undefined && req.user?.role === 'admin') { 
      updates.push(`for_user_id = $${paramCount++}`); values.push(for_user_id); 
    }
    if (is_shared !== undefined && req.user?.role === 'admin') { 
      updates.push(`is_shared = $${paramCount++}`); values.push(is_shared); 
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE saved_filters SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ filter: result.rows[0] });
  } catch (error) {
    console.error('Update saved filter error:', error);
    res.status(500).json({ error: 'Failed to update saved filter' });
  }
};

// Delete a saved filter
export const deleteFilter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check ownership (admins can delete any filter)
    const filterCheck = await pool.query(
      'SELECT id, user_id FROM saved_filters WHERE id = $1',
      [id]
    );

    if (filterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    if (filterCheck.rows[0].user_id !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM saved_filters WHERE id = $1', [id]);

    res.json({ message: 'Filter deleted successfully' });
  } catch (error) {
    console.error('Delete saved filter error:', error);
    res.status(500).json({ error: 'Failed to delete saved filter' });
  }
};
