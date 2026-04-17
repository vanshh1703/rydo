const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models/db');

const register = async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  try {
    // Check if user already exists
    const userExists = await db.query('SELECT * FROM users WHERE email = $1 OR phone = $2', [email, phone]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User with this email or phone already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
      [name, email, phone, passwordHash, role]
    );

    const newUser = result.rows[0];

    // If role is driver, create driver entry
    if (role === 'driver') {
      const { vehicleType } = req.body;
      const driverResult = await db.query(
        'INSERT INTO drivers (user_id, vehicle_type) VALUES ($1, $2) RETURNING id, vehicle_type',
        [newUser.id, vehicleType || 'mini']
      );
      newUser.driverId = driverResult.rows[0].id;
      newUser.vehicleType = driverResult.rows[0].vehicle_type;
    }

    // Create token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        role: newUser.role, 
        driverId: newUser.driverId || null 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({ user: newUser, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let driverId = null;
    let vehicleType = null;
    if (user.role === 'driver') {
      const driverResult = await db.query('SELECT id, vehicle_type FROM drivers WHERE user_id = $1', [user.id]);
      driverId = driverResult.rows[0]?.id;
      vehicleType = driverResult.rows[0]?.vehicle_type;
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        driverId: driverId 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        driverId: driverId,
        vehicleType: vehicleType
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login };
