import { createRoot } from "react-dom/client";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
