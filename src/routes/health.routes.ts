import { Router } from "express";
import mongoose from "mongoose";

const router = Router();


router.get("/", (_req, res) => {
    const isConnected = mongoose.connection.readyState === 1;

    if (!isConnected) {
        return res.status(500).json({
            status: "error",
            db: "disconnected",
        });
    }

    res.json({
        status: "ok",
        db: "connected",
    });
});

export default router;
