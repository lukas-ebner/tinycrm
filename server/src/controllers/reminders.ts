import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

export const createReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, due_at, reason } = req.body;

    if (!lead_id || !due_at) {
      return res.status(400).json({ error: 'lead_id and due_at are required' });
    }

    // Check access
    const leadCheck = await pool.query('SELECT id, assigned_to FROM leads WHERE id = $1', [lead_id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (req.user?.role === 'caller' && leadCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'INSERT INTO reminders (lead_id, user_id, due_at, reason) VALUES ($1, $2, $3, $4) RETURNING *',
      [lead_id, req.user?.id, due_at, reason]
    );

    // Auto-move lead to "Wiedervorlage" stage
    const wiedervorlageStage = await pool.query('SELECT id FROM stages WHERE name = $1', ['Wiedervorlage']);
    if (wiedervorlageStage.rows.length > 0) {
      await pool.query('UPDATE leads SET stage_id = $1 WHERE id = $2', [wiedervorlageStage.rows[0].id, lead_id]);
    }

    res.status(201).json({ reminder: result.rows[0] });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
};

export const getMyReminders = async (req: AuthRequest, res: Response) => {
  try {
    const { due_date } = req.query;

    let query = `
      SELECT r.*, l.name as lead_name
      FROM reminders r
      JOIN leads l ON r.lead_id = l.id
      WHERE r.user_id = $1 AND r.completed = false
    `;

    const values: any[] = [req.user?.id];

    if (due_date) {
      query += ' AND DATE(r.due_at) = $2';
      values.push(due_date);
    }

    query += ' ORDER BY r.due_at ASC';

    const result = await pool.query(query, values);

    res.json({ reminders: result.rows });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
};

export const completeReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if reminder belongs to user
    const reminderCheck = await pool.query(
      'SELECT id, user_id FROM reminders WHERE id = $1',
      [id]
    );

    if (reminderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (req.user?.role === 'caller' && reminderCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'UPDATE reminders SET completed = true WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({ reminder: result.rows[0] });
  } catch (error) {
    console.error('Complete reminder error:', error);
    res.status(500).json({ error: 'Failed to complete reminder' });
  }
};

export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check ownership
    const reminderCheck = await pool.query(
      'SELECT id, user_id FROM reminders WHERE id = $1',
      [id]
    );

    if (reminderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (req.user?.role === 'caller' && reminderCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM reminders WHERE id = $1', [id]);

    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
};

// Update lead stages based on reminder due dates
export const updateReminderStages = async (req: AuthRequest, res: Response) => {
  try {
    // Get the special stage IDs
    const stagesResult = await pool.query(`
      SELECT id, name FROM stages
      WHERE name IN ('Wiedervorlage', 'Heute Nachhaken', 'Überfällig')
    `);

    const stages: Record<string, number> = {};
    stagesResult.rows.forEach((row) => {
      stages[row.name] = row.id;
    });

    // If stages don't exist, return early
    if (!stages['Wiedervorlage'] || !stages['Heute Nachhaken'] || !stages['Überfällig']) {
      return res.json({ message: 'Special stages not found' });
    }

    // Get all incomplete reminders
    const remindersResult = await pool.query(`
      SELECT r.id, r.lead_id, r.due_at
      FROM reminders r
      WHERE r.completed = false
      ORDER BY r.due_at ASC
    `);

    const now = new Date();
    let updated = 0;

    for (const reminder of remindersResult.rows) {
      const dueDate = new Date(reminder.due_at);
      let targetStageId: number | null = null;

      // Determine which stage the lead should be in
      if (dueDate > now) {
        // Future reminder → Wiedervorlage
        targetStageId = stages['Wiedervorlage'];
      } else {
        // Reminder time has passed
        const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dueDay.getTime() === today.getTime()) {
          // Same day → Heute Nachhaken
          targetStageId = stages['Heute Nachhaken'];
        } else {
          // Past day → Überfällig
          targetStageId = stages['Überfällig'];
        }
      }

      // Update lead stage if needed
      if (targetStageId) {
        const updateResult = await pool.query(
          'UPDATE leads SET stage_id = $1 WHERE id = $2 AND stage_id != $1',
          [targetStageId, reminder.lead_id]
        );
        if (updateResult.rowCount && updateResult.rowCount > 0) {
          updated++;
        }
      }
    }

    res.json({
      message: 'Reminder stages updated',
      updated,
      total: remindersResult.rows.length
    });
  } catch (error) {
    console.error('Update reminder stages error:', error);
    res.status(500).json({ error: 'Failed to update reminder stages' });
  }
};
