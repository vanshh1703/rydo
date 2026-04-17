const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with your frontend URL
    methods: ['GET', 'POST']
  }
});

// Attach io to app to it can be used in controllers
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./src/routes/authRoutes');
const rideRoutes = require('./src/routes/rideRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const setupRideSockets = require('./src/sockets/rideSocket');

app.use('/auth', authRoutes);
app.use('/ride', rideRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Rydo Backend API is running');
});

// Initialize Services
const MatchingService = require('./src/services/matchingService');
MatchingService.init(io);

// Initialize Ride Sockets
setupRideSockets(io);

// Basic Connection Logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, server, io };
