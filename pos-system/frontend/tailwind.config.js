module.exports = {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "base-porcelain": "#F7F3ED",
        "base-ivory": "#EFE7DA",
        "text-charcoal": "#1A1A1A",
        "text-warm": "#3A2F26",
        "brand-gold": "#C8A96A",
        "brand-gold-600": "#B6904D",
        "line-soft": "#E7DED2",
        "success-600": "#2E7D32",
        "danger-600": "#C0392B",
        "info-600": "#1E88E5",
        "warning-600": "#D48806",
        "graph-1": "#C8A96A",
        "graph-2": "#7D6B5E",
        "graph-3": "#D9C7A0",
        "graph-4": "#8F8F8F",
        "graph-5": "#3A2F26",
        "graph-6": "#E0B88F"
      },
      fontFamily: {
        display: ["Playfair Display","serif"],
        ui: ["Inter","system-ui","sans-serif"]
      },
      boxShadow: {
        "panel": "0 8px 24px rgba(26,26,26,0.06)",
        "elev-2": "0 2px 10px rgba(26,26,26,0.05)"
      },
      borderRadius: {
        "xl": "12px",
        "lg": "10px",
        "md": "8px"
      }
    }
  },
  plugins: []
}