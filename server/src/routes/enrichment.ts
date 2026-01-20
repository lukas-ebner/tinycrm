import express from 'express';
import { enrichLead, enrichByFilter, getEnrichmentStatus } from '../controllers/enrichment.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Get enrichment status (for all or filtered by import_source)
router.get('/status', getEnrichmentStatus);

// Enrich a single lead (admin only)
router.post('/lead/:id', requireAdmin, enrichLead);

// Enrich multiple leads by filter (admin only)
router.post('/batch', requireAdmin, enrichByFilter);

export default router;
