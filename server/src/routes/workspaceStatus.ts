import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getWorkspaceStatus } from '../controllers/workspaceStatus.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/workspace-status?code=TEST-PROMO-2
router.get('/', getWorkspaceStatus);

export default router;
