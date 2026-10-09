import express from "express";
import type { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import videoRoutes from "./routes/video.routes.js";

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/videos", videoRoutes);

// Centralized Error Handling Middleware
interface CustomError extends Error {
  status?: number;
}

app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

export default app;
