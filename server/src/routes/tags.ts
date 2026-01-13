import express from 'express';
import { getAllTags, createTag, deleteTag } from '../controllers/tags.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAllTags);
router.post('/', createTag);
router.delete('/:id', deleteTag);

export default router;
