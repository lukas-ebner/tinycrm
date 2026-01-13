import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

export const getAllStages = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM stages ORDER BY position ASC');
    res.json({ stages: result.rows });
  } catch (error) {
    console.error('Get stages error:', error);
    res.status(500).json({ error: 'Failed to fetch stages' });
  }
};

export const createStage = async (req: AuthRequest, res: Response) => {
  try {
    const { name, color, position } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color are required' });
    }

    // Get max position if not provided
    const maxPos = position !== undefined ? position : (
      await pool.query('SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM stages')
    ).rows[0].next_pos;

    const result = await pool.query(
      'INSERT INTO stages (name, color, position) VALUES ($1, $2, $3) RETURNING *',
      [name, color, maxPos]
    );

    res.status(201).json({ stage: result.rows[0] });
  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({ error: 'Failed to create stage' });
  }
};

export const updateStage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, position } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (color !== undefined) { updates.push(`color = $${paramCount++}`); values.push(color); }
    if (position !== undefined) { updates.push(`position = $${paramCount++}`); values.push(position); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE stages SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    res.json({ stage: result.rows[0] });
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Failed to update stage' });
  }
};

export const deleteStage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM stages WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    res.json({ message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Delete stage error:', error);
    res.status(500).json({ error: 'Failed to delete stage' });
  }
};

// Initialize special reminder stages
export const initializeReminderStages = async () => {
  const specialStages = [
    { name: 'Wiedervorlage', color: '#3b82f6', position: 1000 },
    { name: 'Heute Nachhaken', color: '#f97316', position: 1001 },
    { name: 'Überfällig', color: '#ef4444', position: 1002 },
  ];

  try {
    for (const stage of specialStages) {
      // Check if stage already exists
      const existing = await pool.query('SELECT id FROM stages WHERE name = $1', [stage.name]);

      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO stages (name, color, position) VALUES ($1, $2, $3)',
          [stage.name, stage.color, stage.position]
        );
        console.log(`✓ Created special stage: ${stage.name}`);
      }
    }
  } catch (error) {
    console.error('Error initializing reminder stages:', error);
  }
};
