import express from 'express';
import { getUserFilters, createFilter, updateFilter, deleteFilter } from '../controllers/savedFilters.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getUserFilters);
router.post('/', createFilter);
router.put('/:id', updateFilter);
router.delete('/:id', deleteFilter);

export default router;
