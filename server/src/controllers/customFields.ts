import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

export const getAllCustomFields = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM custom_field_definitions ORDER BY position ASC');
    res.json({ fields: result.rows });
  } catch (error) {
    console.error('Get custom fields error:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
};

export const createCustomField = async (req: AuthRequest, res: Response) => {
  try {
    const { name, field_type, options, required, position } = req.body;

    if (!name || !field_type) {
      return res.status(400).json({ error: 'Name and field_type are required' });
    }

    const validTypes = ['text', 'number', 'date', 'dropdown', 'checkbox'];
    if (!validTypes.includes(field_type)) {
      return res.status(400).json({ error: 'Invalid field_type' });
    }

    // Get max position if not provided
    const maxPos = position !== undefined ? position : (
      await pool.query('SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM custom_field_definitions')
    ).rows[0].next_pos;

    const result = await pool.query(
      `INSERT INTO custom_field_definitions (name, field_type, options, required, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, field_type, options ? JSON.stringify(options) : null, required || false, maxPos]
    );

    res.status(201).json({ field: result.rows[0] });
  } catch (error) {
    console.error('Create custom field error:', error);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
};

export const updateCustomField = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, field_type, options, required, position } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (field_type !== undefined) { updates.push(`field_type = $${paramCount++}`); values.push(field_type); }
    if (options !== undefined) { updates.push(`options = $${paramCount++}`); values.push(JSON.stringify(options)); }
    if (required !== undefined) { updates.push(`required = $${paramCount++}`); values.push(required); }
    if (position !== undefined) { updates.push(`position = $${paramCount++}`); values.push(position); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE custom_field_definitions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    res.json({ field: result.rows[0] });
  } catch (error) {
    console.error('Update custom field error:', error);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
};

export const deleteCustomField = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM custom_field_definitions WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    res.json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Delete custom field error:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
};
