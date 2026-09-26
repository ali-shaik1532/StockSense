require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const warehouseRoutes = require('./routes/warehouses');
const documentRoutes = require('./routes/documents');
const ledgerRoutes = require('./routes/ledger');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' }
});
app.set('io', io); // so route handlers can do req.app.get('io').emit(...)

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

// Basic request logging (helps a lot during a live demo when something goes wrong)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Central error handler (catches anything that slipped past try/catch)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ errors: ['Unexpected server error.'] });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🚀 StockSense backend running on http://localhost:${PORT}`);
  console.log(`   Socket.io ready for realtime dashboard updates.\n`);
});
