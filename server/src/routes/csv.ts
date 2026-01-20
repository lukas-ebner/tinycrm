import express from 'express';
import multer from 'multer';
import { importCSV, getImportTemplate, getImportSources } from '../controllers/csv.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

router.use(authenticate);
router.use(requireAdmin);

router.post('/import', upload.single('file'), importCSV);
router.get('/template', getImportTemplate);
router.get('/sources', getImportSources);

export default router;
