const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Even though Mongoose uses Models, we export a dummy getDb 
// so your current route structure doesn't crash.
const getDb = () => mongoose.connection;

module.exports = { connectDB, getDb };