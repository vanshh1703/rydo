# Rydo — Real-time Ride Booking Platform

A production-grade ride-hailing marketplace built with React, Node.js, PostgreSQL, and Socket.io.

## 🚀 Quick Start

### 1. Project Setup
```bash
# Install root dependencies
npm install

# Setup Backend
cd backend
npm install
# Update .env with your DB credentials
npm run setup-db
npm run dev

# Setup Frontend
cd ../frontend
npm install
npm run dev
```

## 🏗️ Tech Stack
- **Frontend**: React.js, TailwindCSS, React Router, Lucide Icons, Framer Motion.
- **Backend**: Node.js, Express.js.
- **Database**: PostgreSQL (Relational).
- **Real-time**: Socket.io (matching, tracking).
- **Maps**: Leaflet.js + OpenStreetMap (Free).

## 👤 Features
- **Riders**: Book rides, select locations on map, track drivers live, view trip history.
- **Drivers**: Toggle online status, accept/reject rides, manage trips (Arrived/Started/Completed).
- **Real-time matching**: Automatically finds and notifies the nearest drivers.

## 📂 Project Structure
```text
/backend
  /src
    /controllers  # Auth and Ride logic
    /models       # Pool connection and Schema
    /routes       # API endpoints
    /sockets      # Real-time event handling
    /utils        # Middleware
  server.js       # Entry point

/frontend
  /src
    /components   # MapView, Navbar, etc.
    /context      # Auth state
    /pages        # Landing, Booking, Dashboard, History
    /utils        # Ride helpers
  App.jsx         # Routing
```

## 📜 Database Schema
The database uses a clean normalized schema:
- `users`: Auth and profile.
- `drivers`: Vehicle details and current location.
- `rides`: Ride lifecycle and fare data.
- `ride_requests`: Matching history.

Developed with ❤️ as Rydo.
