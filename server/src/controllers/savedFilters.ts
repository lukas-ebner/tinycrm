import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

// Get all saved filters for the current user
export const getUserFilters = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM saved_filters WHERE user_id = $1 ORDER BY name ASC',
      [req.user?.id]
    );
    res.json({ filters: result.rows });
  } catch (error) {
    console.error('Get saved filters error:', error);
    res.status(500).json({ error: 'Failed to fetch saved filters' });
  }
};

// Create a new saved filter
export const createFilter = async (req: AuthRequest, res: Response) => {
  try {
    const { name, search, stage_id, nace_code, assigned_to, tags, city, zip, min_score } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate tags is array if provided
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    const result = await pool.query(
      `INSERT INTO saved_filters
       (user_id, name, search, stage_id, nace_code, assigned_to, tags, city, zip, min_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        min_score || null
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
    const { name, search, stage_id, nace_code, assigned_to, tags, city, zip, min_score } = req.body;

    // Check ownership
    const filterCheck = await pool.query(
      'SELECT id, user_id FROM saved_filters WHERE id = $1',
      [id]
    );

    if (filterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    if (filterCheck.rows[0].user_id !== req.user?.id) {
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

    // Check ownership
    const filterCheck = await pool.query(
      'SELECT id, user_id FROM saved_filters WHERE id = $1',
      [id]
    );

    if (filterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    if (filterCheck.rows[0].user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM saved_filters WHERE id = $1', [id]);

    res.json({ message: 'Filter deleted successfully' });
  } catch (error) {
    console.error('Delete saved filter error:', error);
    res.status(500).json({ error: 'Failed to delete saved filter' });
  }
};
