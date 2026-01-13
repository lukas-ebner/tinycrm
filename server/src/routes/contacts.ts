import express from 'express';
import { getContactsForLead, createContact, updateContact, deleteContact } from '../controllers/contacts.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/lead/:lead_id', getContactsForLead);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
