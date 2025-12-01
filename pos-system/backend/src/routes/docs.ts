import { Router } from 'express';
import * as swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';

const router = Router();

function loadOpenApiSpec() {
  const specPath = path.join(__dirname, '../docs/openapi.json');
  try {
    const raw = fs.readFileSync(specPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      openapi: '3.0.3',
      info: { title: 'POS Backend API', version: '1.0.0' },
      paths: {},
    };
  }
}

const spec = loadOpenApiSpec();

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(spec));

export default router;
