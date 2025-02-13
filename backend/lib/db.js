import mongoose from "mongoose";

import dotenv from "dotenv";
dotenv.config();


export const connectDB = async () => {
    try {
        const MONGO_URI = process.env.MONGO_URI // Direct MongoDB URI
        const conn = await mongoose.connect(MONGO_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.log("Error connecting to MongoDB:", error.message);
        process.exit(1);
    }
};
