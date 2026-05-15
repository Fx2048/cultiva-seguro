import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startAutoFlush } from "./lib/uplinkQueue";

startAutoFlush();

createRoot(document.getElementById("root")!).render(<App />);
