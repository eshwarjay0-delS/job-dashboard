export const dynamic = "force-dynamic";

export default function KompasDesktopDownload() {
  // Prefer a public release host (R2) when configured. Until then the private
  // perfACT release lets the authorized owner install the same proven desktop.
  const publicDesktopUrl = (process.env.KOMPAS_DESKTOP_URL || "").trim();
  const desktopUrl = publicDesktopUrl || "https://github.com/eshwarjay0-delS/parfAct/releases/download/desktop-latest/Kompas.exe";
  const privateRelease = !publicDesktopUrl;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg, #0e0d0b)",
        color: "var(--text, #ece7dd)",
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: 560, width: "100%" }}>
        <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>Kompas desktop</h1>
        <p style={{ color: "var(--text-muted, #8a8578)", margin: "0 0 24px", lineHeight: 1.6 }}>
          The native wrapper around Kompas. It captures your meeting audio directly
          (Zoom, Teams, Webex) so you never touch a share dialog, and it opens with
          the exact interview session you picked in MarketFit.
        </p>

        <div
          style={{
            border: "1px solid var(--border, rgba(255,255,255,0.12))",
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            background: "var(--surface, rgba(255,255,255,0.03))",
          }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Already installed?</h2>
          <p style={{ color: "var(--text-muted, #8a8578)", margin: "0 0 16px", lineHeight: 1.6, fontSize: 14 }}>
            This tries the <code>kompas://</code> launcher. If the app opens, you are done —
            go back to Kompas, pick <b>Desktop app</b>, and press <b>Connect &amp; start</b>
            to hand it your session.
          </p>
          <button
            id="mfOpenDesktop"
            style={{
              fontSize: 15,
              fontWeight: 700,
              padding: "12px 22px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: "var(--accent, #e8b33c)",
              color: "#1a1408",
            }}
          >
            Open Kompas desktop
          </button>
          <p id="mfOpenMiss" style={{ display: "none", color: "#e07856", fontSize: 14, marginTop: 12 }}>
            Kompas did not open — it is probably not installed yet. Install it below, then try again.
          </p>
        </div>

        <div
          style={{
            border: "1px solid var(--border, rgba(255,255,255,0.12))",
            borderRadius: 12,
            padding: 20,
            background: "var(--surface, rgba(255,255,255,0.03))",
          }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Install it</h2>
          {desktopUrl ? (
            <>
              <p style={{ color: "var(--text-muted, #8a8578)", margin: "0 0 16px", lineHeight: 1.6, fontSize: 14 }}>
                Download the latest executable and open it once to register both desktop launchers.
                MarketFit uses <code>marketfit-kompas://</code>, independently of the standalone
                perfACT app. You can keep the standalone app installed. Return to MarketFit,
                select Desktop app, and press Connect &amp; start.
              </p>
              <a
                href={desktopUrl}
                style={{
                  display: "inline-block",
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "12px 22px",
                  borderRadius: 999,
                  textDecoration: "none",
                  background: "var(--accent, #e8b33c)",
                  color: "#1a1408",
                }}
              >
                Download Kompas.exe
              </a>
              {privateRelease && (
                <p style={{ color: "var(--text-muted, #8a8578)", fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
                  The download is hosted in your private perfACT GitHub repository.
                  Sign in to GitHub with repository access. If clicking the button
                  opens a GitHub sign-in or 404 page, the executable is not publicly
                  downloadable yet. Public hosting can be configured through KOMPAS_DESKTOP_URL.
                </p>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-muted, #8a8578)", margin: 0, lineHeight: 1.7, fontSize: 14 }}>
              The desktop executable is published from the perfACT desktop source. Until it is
              published, use Kompas in the browser — pick <b>Browser tab</b> on the
              connect screen and share the tab with your meeting, audio on. Everything
              else (answers, transcription, sessions) already runs through MarketFit.
            </p>
          )}
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            var btn = document.getElementById('mfOpenDesktop');
            var miss = document.getElementById('mfOpenMiss');
            if (!btn) return;
            btn.addEventListener('click', function(){
              miss.style.display = 'none';
              var left = false;
              var mark = function(){ left = true; };
              window.addEventListener('blur', mark);
              var f = document.createElement('iframe');
              f.style.display = 'none';
              f.src = 'kompas://open';
              document.body.appendChild(f);
              setTimeout(function(){
                f.remove();
                window.removeEventListener('blur', mark);
                if (!left && !document.hidden) miss.style.display = 'block';
              }, 1500);
            });
          })();`,
        }}
      />
    </main>
  );
}
