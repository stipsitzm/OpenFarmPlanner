/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "../src/**/*.{js,ts,jsx,tsx}", // Für die React Modern Gantt-Komponenten
    ],
    darkMode: "class",
    theme: {},
    plugins: [],
};
