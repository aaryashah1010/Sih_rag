export default {
  content: ["./code.html", "./app.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "sans-serif"],
        serif: ['"Newsreader"', "serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      colors: {
        primary: {
          DEFAULT: "#0F4C42",
          hover: "#0A3730",
          subtle: "#EBF4F2",
          light: "#D3E8E3",
          dark: "#082520",
        },
        copper: {
          DEFAULT: "#B85D19",
          subtle: "#FDF3E7",
          border: "#F1C79D",
        },
        caution: {
          DEFAULT: "#9A5B00",
          bg: "#FFF8E6",
          border: "#F6D389",
        },
        risk: {
          DEFAULT: "#B91C1C",
          bg: "#FEF2F2",
          border: "#FECACA",
        },
        slate: {
          850: "#172033",
          950: "#0B1120",
        },
      },
    },
  },
};