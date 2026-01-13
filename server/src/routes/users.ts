import express from 'express';
import { getAllUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/users.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All user routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

router.get('/', getAllUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
