import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        force: true,
        include: ['@supabase/supabase-js']
    },
    base: "/",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
