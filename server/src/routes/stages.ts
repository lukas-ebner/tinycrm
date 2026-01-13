import express from 'express';
import { getAllStages, createStage, updateStage, deleteStage } from '../controllers/stages.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAllStages);
router.post('/', requireAdmin, createStage);
router.put('/:id', requireAdmin, updateStage);
router.delete('/:id', requireAdmin, deleteStage);

export default router;
