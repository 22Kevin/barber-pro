"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Funcionalidades", href: "#features" },
    { label: "Assinatura", href: "#subscription" },
    { label: "Depoimentos", href: "#testimonials" },
    { label: "Preços", href: "#pricing" },
  ];

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
        background: scrolled ? "rgba(5,5,5,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          {/* Logo */}
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663028442847/CHUXnjOFayrIGRtV.png"
              alt="Barber Pro"
              style={{
                width: 40, height: 40, borderRadius: 10,
                objectFit: "cover",
                boxShadow: "0 0 20px rgba(201,168,76,0.3)",
              }}
            />
            <span style={{ color: "#F0EEE8", fontWeight: 700, fontSize: 17, letterSpacing: 0.5 }}>
              Barber <span style={{ color: "#C9A84C" }}>Pro</span>
            </span>
          </a>

          {/* Desktop links — hidden on mobile/tablet via CSS class */}
          <nav className="lp-nav-desktop" style={{ gap: 32, alignItems: "center" }}>
            {links.map((l) => (
              <a key={l.href} href={l.href} style={{
                color: "#888880", fontSize: 14, fontWeight: 500, textDecoration: "none",
                transition: "color 0.2s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F0EEE8")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#888880")}
              >
                {l.label}
              </a>
            ))}
            <a href="#pricing" style={{
              background: "linear-gradient(135deg, #C9A84C, #A07830)",
              color: "#050505", fontWeight: 700, fontSize: 14,
              padding: "9px 20px", borderRadius: 8, textDecoration: "none",
              boxShadow: "0 0 24px rgba(201,168,76,0.25)",
              transition: "opacity 0.2s, transform 0.15s",
              whiteSpace: "nowrap",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Começar Grátis
            </a>
          </nav>

          {/* Mobile/tablet hamburger — shown via CSS class */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lp-nav-mobile-btn"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 8, flexDirection: "column", gap: 5,
            }}
            aria-label="Menu"
          >
            <span style={{ display: "block", width: 22, height: 2, background: "#F0EEE8", borderRadius: 2, transition: "transform 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
            <span style={{ display: "block", width: 22, height: 2, background: "#F0EEE8", borderRadius: 2, transition: "opacity 0.2s", opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: "block", width: 22, height: 2, background: "#F0EEE8", borderRadius: 2, transition: "transform 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
          </button>
        </div>
      </div>

      {/* Mobile/tablet dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              background: "rgba(8,8,8,0.98)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{
                  color: "#888880", fontSize: 16, fontWeight: 500, textDecoration: "none",
                  padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  {l.label}
                </a>
              ))}
              <a href="#pricing" onClick={() => setMenuOpen(false)} style={{
                background: "linear-gradient(135deg, #C9A84C, #A07830)",
                color: "#050505", fontWeight: 700, fontSize: 15,
                padding: "13px 20px", borderRadius: 10, textDecoration: "none",
                textAlign: "center", marginTop: 12,
              }}>
                Começar 14 Dias Grátis
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
