import mongoose from "mongoose";

import dotenv from "dotenv";
dotenv.config();

// LwMMsy2ZfjLOxBVd
// it428741
export const connectDB = async () => {
    try {
        const MONGO_URI = 'mongodb+srv://it428741:LwMMsy2ZfjLOxBVd@ecommercesoch.dt9k5zf.mongodb.net/'// Direct MongoDB URI
        const conn = await mongoose.connect(MONGO_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.log("Error connecting to MongoDB:", error.message);
        process.exit(1);
    }
};
