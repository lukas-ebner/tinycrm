import express from 'express';
import { createReminder, getMyReminders, completeReminder, deleteReminder, updateReminderStages } from '../controllers/reminders.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createReminder);
router.get('/my', getMyReminders);
router.post('/update-stages', updateReminderStages);
router.put('/:id/complete', completeReminder);
router.delete('/:id', deleteReminder);

export default router;
