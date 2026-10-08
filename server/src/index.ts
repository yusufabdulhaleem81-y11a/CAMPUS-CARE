import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { clinicRouter } from './routes/clinic.js';
import { pharmacyRouter } from './routes/pharmacy.js';
import { operationsRouter } from './routes/operations.js';
import { analyticsRouter } from './routes/analytics.js';
import { adminRouter, publicRouter } from './routes/admin.js';

const app = express();
app.use(cors({ origin: env.frontendOrigin, credentials: false }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'fud-campus-care-api' }));
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api', clinicRouter);
app.use('/api', pharmacyRouter);
app.use('/api', operationsRouter);
app.use('/api', analyticsRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

app.listen(env.port, () => {
  console.log(`FUD Campus Care API listening on http://localhost:${env.port}`);
});
