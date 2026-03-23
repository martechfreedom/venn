// server.js - Servidor Node.js para venn.js + BigQuery

const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const cors = require('cors');

const app = express();
const bigquery = new BigQuery();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/build', express.static('build'));
app.use(express.static('public'));

// Porta do Cloud Run (variável de ambiente)
const PORT = process.env.PORT || 8080;

// ============================================
// ROTA 1: Página inicial (interface web)
// ============================================
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ============================================
// ROTA 2: Health check
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'venn-bigquery-api'
  });
});

// ============================================
// ROTA 3: Buscar dados do BigQuery
// ============================================
app.get('/api/venn-data', async (req, res) => {
  try {
    const projectId = req.query.project || process.env.GCP_PROJECT || 'yduqs-dev';
    const datasetId = req.query.dataset || 'venn_dataset';

    console.log(`Consultando: ${projectId}.${datasetId}`);

    // Query para conjunto A (Mobile)
    const queryA = `
      SELECT DISTINCT user_id as id
      FROM \`${projectId}.${datasetId}.eventos_app\`
      WHERE plataforma = 'mobile'
        AND data_evento >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      LIMIT 1000
    `;

    // Query para conjunto B (Web)
    const queryB = `
      SELECT DISTINCT user_id as id
      FROM \`${projectId}.${datasetId}.eventos_app\`
      WHERE plataforma = 'web'
        AND data_evento >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      LIMIT 1000
    `;

    // Query para conjunto C (Newsletter)
    const queryC = `
      SELECT DISTINCT user_id as id
      FROM \`${projectId}.${datasetId}.inscricoes_newsletter\`
      WHERE ativo = TRUE
      LIMIT 1000
    `;

    // Executar queries em paralelo
    const [rowsA] = await bigquery.query({ query: queryA });
    const [rowsB] = await bigquery.query({ query: queryB });
    const [rowsC] = await bigquery.query({ query: queryC });

    // Extrair IDs
    const setA = rowsA.map(row => row.id);
    const setB = rowsB.map(row => row.id);
    const setC = rowsC.map(row => row.id);

    // Calcular interseções (para venn.js)
    const intersectionAB = setA.filter(id => setB.includes(id));
    const intersectionAC = setA.filter(id => setC.includes(id));
    const intersectionBC = setB.filter(id => setC.includes(id));
    const intersectionABC = setA.filter(id => setB.includes(id) && setC.includes(id));

    // Formato esperado pelo venn.js
    const vennData = [
      { sets: ['Mobile'], size: setA.length },
      { sets: ['Web'], size: setB.length },
      { sets: ['Newsletter'], size: setC.length },
      { sets: ['Mobile', 'Web'], size: intersectionAB.length },
      { sets: ['Mobile', 'Newsletter'], size: intersectionAC.length },
      { sets: ['Web', 'Newsletter'], size: intersectionBC.length },
      { sets: ['Mobile', 'Web', 'Newsletter'], size: intersectionABC.length }
    ];

    res.json({
      success: true,
      data: vennData,
      metadata: {
        project: projectId,
        dataset: datasetId,
        timestamp: new Date().toISOString(),
        totals: {
          mobile: setA.length,
          web: setB.length,
          newsletter: setC.length
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================
// ROTA 4: Dados mockados (para teste)
// ============================================
app.get('/api/venn-data/mock', (req, res) => {
  const mockData = [
    { sets: ['Mobile'], size: 150 },
    { sets: ['Web'], size: 200 },
    { sets: ['Newsletter'], size: 100 },
    { sets: ['Mobile', 'Web'], size: 50 },
    { sets: ['Mobile', 'Newsletter'], size: 30 },
    { sets: ['Web', 'Newsletter'], size: 40 },
    { sets: ['Mobile', 'Web', 'Newsletter'], size: 20 }
  ];

  res.json({
    success: true,
    data: mockData,
    metadata: {
      mode: 'mock',
      timestamp: new Date().toISOString()
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
});
