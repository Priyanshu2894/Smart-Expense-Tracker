const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./db'); // Our new MongoDB connection

console.log("Gemini Key:", process.env.GEMINI_API_KEY ? "Loaded" : "Not Loaded");

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            "https://smart-expense-tracker-puce.vercel.app",
            "http://localhost:5173"
        ];

        // Check if the origin starts with your Vercel URL 
        // (This helps if Vercel uses preview links)
        const isAllowed = allowedOrigins.some(authOrigin => origin.startsWith(authOrigin));

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Connect to Database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello World from the Backend!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});