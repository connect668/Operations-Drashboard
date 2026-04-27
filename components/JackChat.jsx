import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const P = {
  pageBg:    "#F5F0FF",
  surface:   "#FFFFFF",
  surfaceSub:"#FAF8FF",
  border:    "#DDD6FE",
  borderMid: "#C4B5FD",
  text:      "#1F1635",
  soft:      "#4C3D7A",
  muted:     "#8B7CC8",
  purple:    "#6D28D9",
  purpleMid: "#7C3AED",
  purpleDim: "rgba(109,40,217,0.10)",
  green:     "#2E7D52",
  amber:     "#92620A",
  red:       "#8A2E2E",
  redDim:    "rgba(138,46,46,0.08)",
};
const BTN_GRAD = "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)";
const SANS = "Inter,ui-sans-serif,system-ui,-apple-system,sans-serif";
const MONO = '"JetBrains Mono","SF Mono",ui-monospace,monospace';

const CHIPS = ["Employee call-off", "Customer refund dispute", "Cash drawer shortage"];

const RobotIcon = ({ size = 20, color = P.purple }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="11" rx="2"/>
    <path d="M8 8V6a4 4 0 018 0v2"/>
    <circle cx="8.5" cy="14" r="1" fill={color}/>
    <circle cx="15.5" cy="14" r="1" fill={color}/>
    <path d="M9.5 17.5h5"/>
  </svg>
);

const Spinner = () => (
  <div style={{
    width: 18, height: 18,
    border: `2px solid ${P.borderMid}`,
    borderTopColor: P.purple,
    borderRadius: "50%",
    animation: "jackSpin 0.8s linear infinite",
    flexShrink: 0,
  }}/>
);

export default function JackChat({ profile = {} }) {
  const [question,          setQuestion]          = useState("");
  const [loading,           setLoading]           = useState(false);
  const [result,            setResult]            = useState(null);
  const [rated,             setRated]             = useState(null);
  const [comment,           setComment]           = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [feedbackSaved,     setFeedbackSaved]     = useState(false);
  const [error,             setError]             = useState("");

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Build a company context string from profile fields to help Jack
  const buildCompanyContext = () => {
    const parts = [];
    if (profile.company) parts.push(`Company: ${profile.company}`);
    if (profile.facility_number) parts.push(`Facility #${profile.facility_number}`);
    if (profile.role) parts.push(`User role: ${profile.role}`);
    return parts.length ? parts.join(" | ") : null;
  };

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    setRated(null);
    setComment("");
    setFeedbackSaved(false);
    setError("");
    try {
      const token = await getToken();
      const companyContext = buildCompanyContext();
      const res = await fetch("/api/jack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q, companyContext }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[JackChat] Non-OK response:", res.status, text);
        setError("Jack is temporarily unavailable. Please try again.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.error && !data.category) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error("[JackChat] fetch error:", err);
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleRate = async (helpful) => {
    setRated(helpful);
    if (!result?.searchId) return;
    try {
      const token = await getToken();
      await fetch("/api/jack-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ searchId: result.searchId, helpful }),
      });
    } catch {}
  };

  const handleFeedbackSubmit = async () => {
    setCommentSubmitting(true);
    try {
      const token = await getToken();
      await fetch("/api/jack-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ searchId: result?.searchId, helpful: rated, comment }),
      });
      setFeedbackSaved(true);
    } catch {}
    setCommentSubmitting(false);
  };

  const handleBack = () => {
    setResult(null);
    setRated(null);
    setComment("");
    setFeedbackSaved(false);
    setError("");
  };

  // ─── LOADING STATE ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ fontFamily: SANS }}>
        <style>{`
          @keyframes jackSpin { to { transform: rotate(360deg); } }
          @keyframes jackPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        `}</style>
        <div style={{
          background: P.surface,
          border: `1px solid ${P.border}`,
          borderRadius: 16,
          padding: "40px 28px",
          textAlign: "center",
          animation: "jackPulse 1.8s ease infinite",
        }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: "50%",
            background: P.purpleDim,
            border: `1.5px solid rgba(109,40,217,0.25)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
          }}>
            <RobotIcon size={24}/>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8 }}>
            Jack is thinking…
          </div>
          <div style={{ fontSize: 13, color: P.muted }}>Searching policies · Generating guidance</div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <Spinner/>
          </div>
        </div>
      </div>
    );
  }

  // ─── ANSWER STATE ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div style={{ fontFamily: SANS }}>
        <style>{`
          @keyframes jackSpin { to { transform: rotate(360deg); } }
          @keyframes jackFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
          .jack-btn:hover { filter: brightness(0.92); }
          .jack-rate:hover { border-color: ${P.borderMid} !important; }
        `}</style>

        {/* Back button */}
        <button
          className="jack-btn"
          onClick={handleBack}
          style={{
            background: "none", border: "none", padding: "0 0 16px",
            fontSize: 13, color: P.muted, cursor: "pointer",
            fontFamily: SANS, display: "flex", alignItems: "center", gap: 6,
          }}>
          ← Ask another
        </button>

        {/* Answer card */}
        <div className="jack-answer-card" style={{
          background: P.surface,
          border: `1px solid ${P.border}`,
          borderRadius: 16,
          borderTop: `3px solid ${P.purple}`,
          overflow: "hidden",
          animation: "jackFadeIn 0.2s ease both",
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${P.border}`,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: P.purpleDim,
              border: `1.5px solid rgba(109,40,217,0.25)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <RobotIcon size={18}/>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: P.text }}>Jack</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
              {result.category && (
                <div style={{
                  background: P.purpleDim,
                  color: P.purple,
                  fontSize: 11, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 20,
                  letterSpacing: "0.04em",
                }}>
                  {result.category}
                </div>
              )}
              {result.aiGenerated && (
                <div style={{
                  background: "rgba(109,40,217,0.06)",
                  border: `1px solid rgba(109,40,217,0.18)`,
                  color: P.muted,
                  fontSize: 10, fontWeight: 600,
                  padding: "3px 9px", borderRadius: 20,
                  letterSpacing: "0.05em",
                }}>
                  AI · Claude
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "20px" }}>
            {/* No policy warning */}
            {result.noPolicy && (
              <div style={{
                background: "rgba(146,98,10,0.08)",
                border: `1px solid rgba(146,98,10,0.25)`,
                borderRadius: 10, padding: "12px 16px",
                marginBottom: 18,
                fontSize: 13, color: P.amber, fontWeight: 600,
              }}>
                No direct policy match found. Please escalate this situation to your manager.
              </div>
            )}

            {/* THE PLAY */}
            {result.thePlay && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
                  color: P.purple, textTransform: "uppercase", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  <div style={{ width: 3, height: 14, background: P.purple, borderRadius: 2, flexShrink: 0 }}/>
                  THE PLAY
                </div>
                <div style={{
                  fontSize: 14, color: P.text, lineHeight: 1.75,
                  whiteSpace: "pre-wrap",
                  borderLeft: `3px solid ${P.purpleDim}`,
                  paddingLeft: 14,
                }}>
                  {result.thePlay}
                </div>
              </div>
            )}

            {/* POLICY BEHIND IT */}
            {result.policyContext && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
                  color: P.muted, textTransform: "uppercase", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  <div style={{ width: 3, height: 14, background: P.border, borderRadius: 2, flexShrink: 0 }}/>
                  POLICY BEHIND IT
                </div>
                <div style={{ fontSize: 13, color: P.soft, lineHeight: 1.65 }}>
                  {result.policyContext}
                </div>
              </div>
            )}

            {/* WATCH OUTS */}
            {result.watchOuts && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
                  color: P.amber, textTransform: "uppercase", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  <div style={{ width: 3, height: 14, background: P.amber, borderRadius: 2, flexShrink: 0 }}/>
                  ⚠ WATCH OUTS
                </div>
                <div style={{
                  fontSize: 13, color: P.amber, lineHeight: 1.65,
                  borderLeft: `3px solid rgba(146,98,10,0.25)`,
                  paddingLeft: 14,
                }}>
                  {result.watchOuts}
                </div>
              </div>
            )}

            {/* ESCALATE IF */}
            {result.escalateIf && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
                  color: P.red, textTransform: "uppercase", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  <div style={{ width: 3, height: 14, background: P.red, borderRadius: 2, flexShrink: 0 }}/>
                  ESCALATE IF
                </div>
                <div style={{
                  fontSize: 13, color: P.red, lineHeight: 1.65,
                  borderLeft: `3px solid rgba(138,46,46,0.25)`,
                  paddingLeft: 14,
                }}>
                  {result.escalateIf}
                </div>
              </div>
            )}

            {/* Rating block */}
            <div style={{
              borderTop: `1px solid ${P.border}`,
              paddingTop: 18, marginTop: 4,
            }}>
              {feedbackSaved ? (
                <div style={{ fontSize: 13, color: P.green, fontWeight: 600 }}>
                  ✓ Feedback saved — thank you
                </div>
              ) : (
                <>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: P.muted,
                    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12,
                  }}>
                    Was this helpful?
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: rated !== null ? 16 : 0 }}>
                    <button
                      className="jack-rate"
                      onClick={() => handleRate(true)}
                      style={{
                        padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: SANS, transition: "all 0.15s",
                        background: rated === true ? "rgba(46,125,82,0.1)" : P.surface,
                        color: rated === true ? P.green : P.muted,
                        border: `1.5px solid ${rated === true ? P.green : P.border}`,
                      }}>
                      ✓ Helpful
                    </button>
                    <button
                      className="jack-rate"
                      onClick={() => handleRate(false)}
                      style={{
                        padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: SANS, transition: "all 0.15s",
                        background: rated === false ? "rgba(138,46,46,0.08)" : P.surface,
                        color: rated === false ? P.red : P.muted,
                        border: `1.5px solid ${rated === false ? P.red : P.border}`,
                      }}>
                      ✗ Not helpful
                    </button>
                  </div>

                  {/* Comment after rating */}
                  {rated !== null && (
                    <div>
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Any details? (optional)"
                        rows={2}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          padding: "10px 12px", borderRadius: 8,
                          border: `1.5px solid ${P.border}`,
                          fontSize: 13, color: P.text, fontFamily: SANS,
                          resize: "vertical", outline: "none",
                          background: P.surfaceSub,
                          marginBottom: 10,
                        }}
                      />
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          className="jack-btn"
                          onClick={handleFeedbackSubmit}
                          disabled={commentSubmitting}
                          style={{
                            background: BTN_GRAD, color: "#fff",
                            border: "none", borderRadius: 8,
                            padding: "9px 18px", fontSize: 13, fontWeight: 600,
                            cursor: commentSubmitting ? "not-allowed" : "pointer",
                            opacity: commentSubmitting ? 0.6 : 1,
                            fontFamily: SANS,
                          }}>
                          {commentSubmitting ? "Saving…" : "Submit feedback"}
                        </button>
                        <button
                          className="jack-btn"
                          onClick={() => setFeedbackSaved(true)}
                          style={{
                            background: "none", border: `1.5px solid ${P.border}`,
                            borderRadius: 8, padding: "9px 18px",
                            fontSize: 13, color: P.muted, cursor: "pointer",
                            fontFamily: SANS,
                          }}>
                          Skip
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── INPUT STATE ──────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        @keyframes jackSpin { to { transform: rotate(360deg); } }
        .jack-btn:hover { filter: brightness(0.92); }
        .jack-chip:hover { border-color: #7C3AED !important; color: #6D28D9 !important; }
        .jack-rate:hover { border-color: ${P.borderMid} !important; }
        .jack-answer-card { animation: jackFadeIn 0.2s ease both; }
        @keyframes jackFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: P.purpleDim,
          border: `1.5px solid rgba(109,40,217,0.25)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <RobotIcon size={26}/>
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: P.text }}>
          Ask Jack
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: P.muted, lineHeight: 1.6 }}>
          Policy &amp; procedure guidance — powered by your company's playbook
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(138,46,46,0.08)",
          border: `1px solid rgba(138,46,46,0.25)`,
          borderRadius: 10, padding: "12px 16px",
          fontSize: 13, color: P.red, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={question}
        onChange={e => setQuestion(e.target.value.slice(0, 500))}
        placeholder="What situation do you need help with? e.g. 'Employee called off 20 min before shift'"
        rows={4}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "14px 16px",
          borderRadius: 12,
          border: `1.5px solid ${P.border}`,
          fontSize: 14, color: P.text, fontFamily: SANS,
          resize: "vertical", minHeight: 100,
          outline: "none", background: P.surface,
          lineHeight: 1.65,
          marginBottom: 6,
        }}
        onKeyDown={e => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault(); handleAsk();
          }
        }}
      />

      {/* Char count */}
      <div style={{
        textAlign: "right", fontSize: 11, color: P.muted,
        fontFamily: MONO, marginBottom: 14,
      }}>
        {question.length}/500
      </div>

      {/* Ask button */}
      <button
        className="jack-btn"
        onClick={handleAsk}
        disabled={!question.trim()}
        style={{
          width: "100%", background: question.trim() ? BTN_GRAD : P.border,
          color: question.trim() ? "#fff" : P.muted,
          border: "none", borderRadius: 12,
          padding: "14px 20px", fontSize: 15, fontWeight: 700,
          cursor: question.trim() ? "pointer" : "not-allowed",
          fontFamily: SANS, transition: "all 0.15s",
          marginBottom: 20,
          boxShadow: question.trim() ? "0 4px 18px rgba(109,40,217,0.28)" : "none",
        }}>
        Ask Jack →
      </button>

      {/* Example chips */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center",
      }}>
        {CHIPS.map(chip => (
          <button
            key={chip}
            className="jack-chip"
            onClick={() => setQuestion(chip)}
            style={{
              background: P.surfaceSub,
              border: `1.5px solid ${P.border}`,
              borderRadius: 20, padding: "6px 14px",
              fontSize: 12, color: P.soft, fontWeight: 600,
              cursor: "pointer", fontFamily: SANS,
              transition: "all 0.15s",
            }}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
