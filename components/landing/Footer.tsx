"use client";
import { motion } from "framer-motion";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "#030303",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="lp-footer-inner">
        <div className="lp-footer-top">
          {/* Brand */}
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663028442847/CHUXnjOFayrIGRtV.png"
                alt="Barber Pro"
                style={{ width: 36, height: 36, borderRadius: 9, objectFit: "cover" }}
              />
              <span style={{ color: "#F0EEE8", fontWeight: 700, fontSize: 16 }}>
                Barber <span style={{ color: "#C9A84C" }}>Pro</span>
              </span>
            </div>
            <p style={{ color: "#555550", fontSize: 13, lineHeight: 1.65 }}>
              Sistema completo de gestão para barbearias. Agendamentos, financeiro,
              assinatura recorrente e muito mais — tudo em um só lugar.
            </p>
          </div>

          {/* Links */}
          <div className="lp-footer-links">
            <div>
              <p style={{ color: "#888880", fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
                Produto
              </p>
              {["Funcionalidades", "Assinatura", "Preços", "PWA"].map((l) => (
                <a key={l} href="#" style={{ display: "block", color: "#555550", fontSize: 14, marginBottom: 10, textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#888880")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555550")}
                >
                  {l}
                </a>
              ))}
            </div>
            <div>
              <p style={{ color: "#888880", fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
                Suporte
              </p>
              {["Central de Ajuda", "WhatsApp", "Status", "Contato"].map((l) => (
                <a key={l} href="#" style={{ display: "block", color: "#555550", fontSize: 14, marginBottom: 10, textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#888880")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555550")}
                >
                  {l}
                </a>
              ))}
            </div>
            <div>
              <p style={{ color: "#888880", fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
                Legal
              </p>
              {["Privacidade", "Termos de Uso", "Cookies"].map((l) => (
                <a key={l} href="#" style={{ display: "block", color: "#555550", fontSize: 14, marginBottom: 10, textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#888880")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555550")}
                >
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="lp-footer-bottom">
          <p style={{ color: "#333330", fontSize: 13 }}>
            © {year} Barber Pro. Todos os direitos reservados.
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {/* Instagram */}
            <a href="#" aria-label="Instagram" style={{ color: "#333330", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#888880")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#333330")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
              </svg>
            </a>
            {/* WhatsApp */}
            <a href="#" aria-label="WhatsApp" style={{ color: "#333330", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#888880")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#333330")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
