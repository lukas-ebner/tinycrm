import express from 'express';
import { createNote, getLeadNotes } from '../controllers/notes.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createNote);
router.get('/lead/:lead_id', getLeadNotes);

export default router;
