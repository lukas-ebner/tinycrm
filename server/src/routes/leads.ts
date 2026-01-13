import express from 'express';
import { getAllLeads, getLead, createLead, updateLead, deleteLead, bulkAssignLeads, bulkAssignFromFilter, addTagToLead, removeTagFromLead } from '../controllers/leads.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAllLeads);
router.get('/:id', getLead);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);
router.post('/bulk-assign', bulkAssignLeads);
router.post('/bulk-assign-filter', bulkAssignFromFilter);
router.post('/:id/tags', addTagToLead);
router.delete('/:id/tags/:tag_id', removeTagFromLead);

export default router;
