import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: "#f97316",
      },
      screens: {
        xs: "375px",
      },
    },
  },
  plugins: [],
} satisfies Config;
