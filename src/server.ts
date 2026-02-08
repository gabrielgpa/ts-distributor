import express from 'express';
import cors from 'cors';
import { distributeWork } from './distribution/algorithm';
import type { DistributionRequest } from './distribution/algorithm';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/distribute', (req, res) => {
  try {
    const payload = req.body as DistributionRequest;
    const result = distributeWork(payload);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`[api] running at http://localhost:${port}`);
});
