import express from 'express';
import { getAllCustomFields, createCustomField, updateCustomField, deleteCustomField } from '../controllers/customFields.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAllCustomFields);
router.post('/', requireAdmin, createCustomField);
router.put('/:id', requireAdmin, updateCustomField);
router.delete('/:id', requireAdmin, deleteCustomField);

export default router;
