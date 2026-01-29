import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import leadRoutes from './routes/leads.js';
import stageRoutes from './routes/stages.js';
import tagRoutes from './routes/tags.js';
import noteRoutes from './routes/notes.js';
import reminderRoutes from './routes/reminders.js';
import customFieldRoutes from './routes/customFields.js';
import csvRoutes from './routes/csv.js';
import contactRoutes from './routes/contacts.js';
import savedFiltersRoutes from './routes/savedFilters.js';
import enrichmentRoutes from './routes/enrichment.js';
import promoCodeRoutes from './routes/promoCodes.js';
import workspaceStatusRoutes from './routes/workspaceStatus.js';
import { initializeReminderStages } from './controllers/stages.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5176', 'http://localhost:5175', 'http://localhost:5174', 'http://localhost:5173']
  : ['http://localhost:5176', 'http://localhost:5175', 'http://localhost:5174', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/csv', csvRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/saved-filters', savedFiltersRoutes);
app.use('/api/enrichment', enrichmentRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/workspace-status', workspaceStatusRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);

  // Initialize special reminder stages
  await initializeReminderStages();
});

export default app;
