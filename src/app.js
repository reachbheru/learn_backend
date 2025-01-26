import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
); //config for cors
app.use(express.json({ limit: "16kb" })); //config to accept json data
app.use(express.urlencoded({ limit: "16kb", extended: true })); //config to accept urlencoding like %20 for space
app.use(express.static("public")); //to store public assest like file or images
app.use(cookieParser()); //config for cookie-parser

//import routes
import userRouter from "./routes/user.routes.js";

//routes declaration
app.use("/api/v1/users", userRouter);

export { app };
