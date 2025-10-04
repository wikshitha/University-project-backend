import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import authRoutes from "./routes/authRoutes.js";
import vaultRoutes from "./routes/vaultRoutes.js";
import releaseRoutes from "./routes/releaseRoutes.js";

dotenv.config();

const app = express();


app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/vaults", vaultRoutes);
app.use("/api/releases", releaseRoutes);


app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

let mongoUrl = process.env.MONGO_URL;

mongoose.connect(mongoUrl)

let connection = mongoose.connection
connection.once("open",()=>{
    console.log("Mongodb connection succes");
    
})