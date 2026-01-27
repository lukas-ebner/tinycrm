import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getPromoCodeLists,
  getPromoCodes,
  importPromoCodes,
  assignPromoCodeToLead,
  unassignPromoCode,
  getPromoCodeForLead,
  markCodeAsRedeemed
} from '../controllers/promoCodes.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Lists
router.get('/lists', getPromoCodeLists);

// Codes
router.get('/', getPromoCodes);
router.post('/import', importPromoCodes);
router.post('/assign', assignPromoCodeToLead);
router.post('/:id/unassign', unassignPromoCode);
router.get('/lead/:lead_id', getPromoCodeForLead);
router.post('/redeem', markCodeAsRedeemed);

export default router;
