import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

export const getContactsForLead = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id } = req.params;

    console.log('Fetching contacts for lead:', lead_id);

    const result = await pool.query(
      'SELECT * FROM contacts WHERE lead_id = $1 ORDER BY last_name, first_name',
      [lead_id]
    );

    console.log('Found contacts:', result.rows.length);

    res.json({ contacts: result.rows });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts', details: error });
  }
};

export const createContact = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, first_name, last_name, role, email, phone, notes } = req.body;

    if (!lead_id || !first_name || !last_name) {
      return res.status(400).json({ error: 'lead_id, first_name, and last_name are required' });
    }

    const result = await pool.query(
      `INSERT INTO contacts (lead_id, first_name, last_name, role, email, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [lead_id, first_name, last_name, role, email, phone, notes]
    );

    res.status(201).json({ contact: result.rows[0] });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
};

export const updateContact = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, email, phone, notes } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (first_name !== undefined) { updates.push(`first_name = $${paramCount++}`); values.push(first_name); }
    if (last_name !== undefined) { updates.push(`last_name = $${paramCount++}`); values.push(last_name); }
    if (role !== undefined) { updates.push(`role = $${paramCount++}`); values.push(role); }
    if (email !== undefined) { updates.push(`email = $${paramCount++}`); values.push(email); }
    if (phone !== undefined) { updates.push(`phone = $${paramCount++}`); values.push(phone); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE contacts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ contact: result.rows[0] });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
};

export const deleteContact = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
};
