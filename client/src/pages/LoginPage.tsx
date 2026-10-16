import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";

type Mode = "email" | "phone";

export function LoginPage() {
  const { human, loginWithToken, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("email");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [existingAccount, setExistingAccount] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [adultAttested, setAdultAttested] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [devHint, setDevHint] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && human) return <Navigate to="/" replace />;

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body =
        mode === "email"
          ? { email: destination.trim() }
          : { phone: destination.trim() };
      const res = await api.requestOtp(body);
      setDevHint(res.devOtpHint);
      setExistingAccount(Boolean(res.existingAccount));
      setNeedsOnboarding(!res.existingAccount);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = {
        ...(mode === "email"
          ? { email: destination.trim() }
          : { phone: destination.trim() }),
        code: code.trim(),
        ...(needsOnboarding
          ? {
              adultAttested,
              firstName: firstName.trim() || undefined,
              lastName: lastName.trim() || undefined,
            }
          : {}),
      };
      const res = await api.verifyOtp(body);
      await loginWithToken(res.token);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.body as { requiresAdultAttestation?: boolean } | undefined;
        if (data?.requiresAdultAttestation) {
          setNeedsOnboarding(true);
          setExistingAccount(false);
          setError("Please confirm you are 18+ to finish creating your account.");
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : "Verification failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-mark">Novellia Pets</div>
        <p>Warm records for the animals you share a life with.</p>

        {step === "request" ? (
          <form onSubmit={(e) => void requestOtp(e)}>
            <div className="row" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className={`btn ${mode === "email" ? "" : "secondary"}`}
                onClick={() => setMode("email")}
              >
                Email
              </button>
              <button
                type="button"
                className={`btn ${mode === "phone" ? "" : "secondary"}`}
                onClick={() => setMode("phone")}
              >
                Phone
              </button>
            </div>
            <div className="field">
              <label htmlFor="destination">
                {mode === "email" ? "Email address" : "Phone number"}
              </label>
              <input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={mode === "email" ? "you@example.com" : "+15551234567"}
                required
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send one-time code"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void verifyOtp(e)}>
            <p className="muted">
              {existingAccount
                ? "Welcome back — enter the code to open your dashboard."
                : "New here — enter the code and confirm a few details."}{" "}
              Sent to <strong>{destination}</strong>
              {devHint ? ` — Dev OTP: ${devHint}` : " (check server console)"}
            </p>
            <div className="field">
              <label htmlFor="code">One-time code</label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
              />
            </div>
            {needsOnboarding && (
              <>
                <div className="field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    placeholder="Optional — used when naming a new household later"
                  />
                </div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={adultAttested}
                    onChange={(e) => setAdultAttested(e.target.checked)}
                    required
                  />
                  <span>I confirm I am 18 years of age or older.</span>
                </label>
              </>
            )}
            {error && <p className="error">{error}</p>}
            <div className="row">
              <button className="btn" type="submit" disabled={busy}>
                {busy
                  ? "Verifying…"
                  : existingAccount
                    ? "Open dashboard"
                    : "Continue"}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setStep("request");
                  setCode("");
                  setError(null);
                  setNeedsOnboarding(false);
                  setExistingAccount(false);
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
