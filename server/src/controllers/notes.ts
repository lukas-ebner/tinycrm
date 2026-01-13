import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

export const createNote = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, content } = req.body;

    if (!lead_id || !content) {
      return res.status(400).json({ error: 'lead_id and content are required' });
    }

    // Check if lead exists and user has access
    const leadCheck = await pool.query('SELECT id, assigned_to FROM leads WHERE id = $1', [lead_id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Callers can only add notes to their assigned leads
    if (req.user?.role === 'caller' && leadCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `INSERT INTO notes (lead_id, user_id, content) VALUES ($1, $2, $3)
       RETURNING id, lead_id, user_id, content, created_at`,
      [lead_id, req.user?.id, content]
    );

    // Update lead updated_at
    await pool.query('UPDATE leads SET updated_at = NOW() WHERE id = $1', [lead_id]);

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
};

export const getLeadNotes = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id } = req.params;

    // Check access
    const leadCheck = await pool.query('SELECT id, assigned_to FROM leads WHERE id = $1', [lead_id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (req.user?.role === 'caller' && leadCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT n.*, u.name as user_name
       FROM notes n
       LEFT JOIN users u ON n.user_id = u.id
       WHERE n.lead_id = $1
       ORDER BY n.created_at DESC`,
      [lead_id]
    );

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};
