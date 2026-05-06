"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";
const INVITE_ID = "INVITE-TEST-0001";
const SYNTHETIC_OTP = "000000";
const claim = {
  id: "CLM-TEST-0001",
  patient: "Test Patient Alpha",
  owner: "Insurance Desk Test Owner",
  insurerOrTpa: "Example TPA Sandbox",
  amount: "INR 1,25,000",
  status: "Awaiting evidence"
};
const worklistRows = [
  [claim.id, claim.patient, claim.insurerOrTpa, "Cashless pre-auth", claim.owner, "Open", "02h 20m", claim.amount, claim.status],
  ["CLM-TEST-0002", "Test Patient Beta", "Example Insurer Desk", "Query response", "Billing Test Owner", "Pending", "1 day", "INR 84,000", "Doctor note pending"],
  ["CLM-TEST-0003", "Test Patient Gamma", "Example Scheme Authority", "Final settlement", "Finance Test Owner", "Open", "4 days", "INR 2,18,000", "Short payment review"]
];
const manualRows = [
  ["Test email acknowledgement for CLM-TEST-0001", "10:42", claim.id, "74%", "Needs manual match"],
  ["Synthetic settlement advice row", "09:30", "CLM-TEST-0003", "61%", "Amount mismatch"],
  ["Portal export upload", "Yesterday", "No match", "28%", "Counterparty reference missing"]
];
const financeRows = [
  ["Outstanding ageing 0-2 days", "8", "INR 5.2L", "Insurance desk follow-up"],
  ["Outstanding ageing 3-7 days", "4", "INR 7.1L", "Escalate query evidence"],
  ["Outstanding ageing 8+ days", "2", "INR 6.1L", "Billing and finance recovery review"]
];

type AuthUser = {
  user_id: string;
  name: string;
  roles: string[];
  branch_scope: { all_branches: boolean; branch_ids: string[] };
};

export default function Home() {
  const [apiLive, setApiLive] = useState(false);
  const [authStatus, setAuthStatus] = useState<"pending" | "starting" | "signed_in" | "error">("pending");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [evidenceAttached, setEvidenceAttached] = useState(false);
  const [noPatientConfirmed, setNoPatientConfirmed] = useState(false);
  const [manualMatched, setManualMatched] = useState(false);
  const [stage, setStage] = useState("All");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/health`, { signal: controller.signal }).then((response) => setApiLive(response.ok)).catch(() => setApiLive(false));
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => worklistRows.filter((row) => stage === "All" || row[3] === stage), [stage]);
  const activeSendEvidenceCaptured = acknowledged && evidenceAttached && noPatientConfirmed;
  const loggedIn = authStatus === "signed_in";

  async function acceptInvite() {
    setAuthStatus("starting");
    try {
      const invite = await fetch(`${API_BASE}/invites/${INVITE_ID}`, { credentials: "include" });
      if (!invite.ok) throw new Error("Invite read failed");

      const accepted = await fetch(`${API_BASE}/invites/${INVITE_ID}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "Insurance Desk Test Owner", phone: null, otp: SYNTHETIC_OTP })
      });
      const verifyPayload = await accepted.json();
      if (!accepted.ok) throw new Error(verifyPayload?.message ?? "Invite acceptance failed");

      setAuthUser(verifyPayload.data.user);
      setAuthStatus("signed_in");
    } catch {
      setAuthStatus("error");
    }
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      setAuthUser(null);
      setAuthStatus("pending");
    }
  }

  function downloadFinanceExport() {
    const csv = [
      "claim_id,owner,insurer_or_tpa,claim_value_inr,status,redaction_status",
      `${claim.id},${claim.owner},${claim.insurerOrTpa},125000,synthetic settlement,redacted`
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "synthetic-finance-export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="ey-kicker">Eyther Phase 1</p>
          <h1>Unified cashless claims dashboard</h1>
          <p className="subtle">Lotus Valley Test Hospital | insurance desk | synthetic local build | API {API_BASE}</p>
        </div>
        <div className="topbar-actions">
          <Badge tone={apiLive ? "good" : "warn"}>{apiLive ? "Live API" : "Demo fallback"}</Badge>
          <Button data-testid="accept-invite" onClick={acceptInvite} disabled={authStatus === "starting"} primary>
            {loggedIn ? "Signed in" : authStatus === "starting" ? "Signing in" : "Accept invite"}
          </Button>
          {loggedIn ? <Button data-testid="logout" onClick={logout}>Sign out</Button> : null}
        </div>
      </header>
      <nav className="route-tabs" aria-label="Phase 1 sections">
        {["Setup", "Worklist", "Claim", "Manual match", "Owners", "Finance export", "Audit"].map((item) => <span key={item}>{item}</span>)}
      </nav>
      <section className="login-strip">
        <div>
          <span>Invite / login</span>
          <strong>{loggedIn ? `${authUser?.name ?? "Insurance desk"} signed in` : authStatus === "error" ? "Login needs API" : "Synthetic invite pending"}</strong>
          <small>{loggedIn ? `Roles: ${authUser?.roles.join(", ")} | Branch scope: all branches` : "API-backed invite and session cookie flow"}</small>
        </div>
        <div><span>Safety</span><strong>No patient data</strong><small>Synthetic only; no real claim documents, email bodies, or identifiers</small></div>
        <div><span>Active Send</span><strong>Blocked</strong><small>{activeSendEvidenceCaptured ? "Synthetic evidence captured; reviewer/live guard still blocks Send" : "Missing evidence or acknowledgement required"}</small></div>
      </section>
      <section className="metric-grid">
        <Stat label="Claims worklist" value="14" detail="Open cashless claims" tone="info" />
        <Stat label="Manual match queue" value="5" detail="Needs human confirmation" tone="warn" />
        <Stat label="Owner ageing" value="INR 18.4L" detail="Pending movement" tone="bad" />
        <Stat label="Active Send" value="Blocked" detail="Reviewer-gated live evidence required" tone="blocked" />
      </section>
      <section className="workspace-grid">
        <Panel title="Setup Readiness" kicker="Go-live gates">
          <div className="readiness-grid">
            <Readiness label="Hospital profile" status="Ready" detail="Branch, role, and no-PII onboarding records captured." tone="good" />
            <Readiness label="Mailbox" status="Test mode" detail="Synthetic email metadata only; no raw bodies or mailbox screenshots." tone="info" />
            <Readiness label="Insurer / TPA route" status="Evidence gated" detail="Live Send remains blocked until hospital x counterparty proof is attached." tone="warn" />
            <Readiness label="Sensitive reveal" status="Audited" detail="Claim identifiers stay masked unless a reveal reason is recorded." tone="good" />
          </div>
        </Panel>
        <Panel title="Mailbox Status" kicker="Metadata only">
          <div className="mailbox-box">
            <div><span>Status</span><strong>{apiLive ? "Connected" : "Synthetic fallback"}</strong></div>
            <div><span>Test email</span><strong>{acknowledged ? "Acknowledged" : "Pending"}</strong></div>
            <div><span>Raw body capture</span><strong>Off</strong></div>
            <div><span>Manual match</span><strong>{manualMatched ? "Linked" : "Needs review"}</strong></div>
          </div>
          <div className="test-email-controls">
            <Button data-testid="test-email-acknowledgement" onClick={() => setAcknowledged(true)} primary>Acknowledge test email</Button>
            <Button onClick={() => setAcknowledged(false)}>Reset acknowledgement</Button>
          </div>
          <p className="subtle">{acknowledged ? "Acknowledged test email - no patient data - synthetic only." : "Test email controls are no-PII and do not send real mail."}</p>
        </Panel>
      </section>
      <Panel title="Counterparty Readiness" kicker="Insurer / TPA / scheme authority">
        <Table headers={["Counterparty", "Type", "Status", "Evidence", "Send"]} rows={[
          ["Example TPA Sandbox", "TPA", "Test route", "No-patient-data acknowledgement", "Draft only"],
          ["Example Insurer Desk", "Insurer", "Evidence needed", "Hospital-specific instruction missing", "Blocked"],
          ["Example Scheme Authority", "Scheme authority", "Portal route", "Manual portal proof required", "Blocked"]
        ]} />
      </Panel>
      <Panel title="Claims Worklist" kicker="Claim officer operating home" action={
        <select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filter worklist stage">
          {["All", "Cashless pre-auth", "Query response", "Final settlement"].map((item) => <option key={item}>{item}</option>)}
        </select>
      }>
        <Table headers={["Claim", "Patient", "Insurer / TPA", "Stage", "Owner", "State", "TAT", "Amount", "Status"]} rows={rows} />
      </Panel>
      <section className="workspace-grid">
        <Panel title="Active Send Evidence" kicker={claim.id}>
          <div className="status-callout">
            <Badge tone="blocked">Blocked</Badge>
            <strong>{activeSendEvidenceCaptured ? "Synthetic evidence captured - live Send still blocked" : "Missing evidence - acknowledgement required"}</strong>
            <span>Active Send remains draft-only until exact hospital x insurer / TPA / scheme authority evidence exists.</span>
          </div>
          <div className="draft-grid">
            <div><span>Claim</span><strong>{claim.id}</strong></div>
            <div><span>Patient display</span><strong>{claim.patient}</strong></div>
            <div><span>Owner</span><strong>{claim.owner}</strong></div>
            <div><span>Counterparty</span><strong>{claim.insurerOrTpa}</strong></div>
          </div>
          <div className="evidence-list">
            <EvidenceRow ok={evidenceAttached} label="Hospital x counterparty route evidence" detail="Synthetic setup artifact attached" />
            <EvidenceRow ok={acknowledged} label="Test email acknowledgement" detail="No patient data confirmation recorded" />
            <EvidenceRow ok={noPatientConfirmed} label="No patient data confirmation" detail="Reviewer-visible safety gate" />
          </div>
          <div className="button-row">
            <Button data-testid="attach-send-evidence" onClick={() => { setEvidenceAttached(true); setAcknowledged(true); }}>Attach evidence</Button>
            <Button data-testid="confirm-no-patient-data" onClick={() => setNoPatientConfirmed(true)}>Confirm no patient data</Button>
            <Button disabled primary>Active Send</Button>
          </div>
        </Panel>
        <Panel title="Manual Match Queue" kicker="Unmatched test email">
          <Table headers={["Event", "Received", "Possible claim", "Confidence", "Blocker"]} rows={manualRows} compact />
          <div className="button-row"><Button data-testid="manual-match-email" onClick={() => setManualMatched(true)} primary>Manual match email</Button></div>
          <p className="subtle">{manualMatched ? `Matched and linked to ${claim.id}.` : "Unmatched test email needs claim officer confirmation."}</p>
        </Panel>
      </section>
      <section className="panel-row">
        <QueuePanel title="Owner Summary" count="14 open" value="INR 18.4L" detail={`${claim.owner} has pending TAT movement`} tone="warn" />
        <QueuePanel title="Queries" count="7 pending" value="INR 8.4L" detail="Doctor note, tariff proof, discharge summary" tone="info" />
        <QueuePanel title="Final Settlements" count="4 open" value="INR 6.9L" detail="Settlement and payment advice review" tone="bad" />
      </section>
      <section className="workspace-grid">
        <Panel title="Claim Timeline" kicker="Audit trail">
          <ol className="timeline">
            {["Cashless pre-auth draft created", "Test email acknowledgement received", "Query response held", "Short payment marked for billing review"].map((event, index) => <li key={event}><span>{index ? "10:42" : "11:10"}</span><div><strong>{claim.id} - {event}</strong><small>Audit - synthetic evidence - redacted</small></div></li>)}
          </ol>
        </Panel>
        <Panel title="Finance Export" kicker="Settlement and payment advice">
          <div className="finance-head"><strong>INR 18.4L</strong><span>Redacted settlement file</span></div>
          <Table headers={["Bucket", "Claims", "Value", "Next step"]} rows={financeRows} compact />
          <div className="button-row"><Button data-testid="download-finance-export" onClick={downloadFinanceExport} primary>Download finance export CSV</Button></div>
          <div className="blocked-state"><Badge tone="good">Redacted</Badge><span>Export excludes patient and policy identifiers until reveal is approved.</span></div>
        </Panel>
      </section>
      <Panel title="Audit And Redaction Evidence" kicker="Reviewer evidence">
        <div className="audit-grid">
          <AuditItem label="Active Send" value={activeSendEvidenceCaptured ? "Still blocked after synthetic evidence" : "Blocked until evidence"} />
          <AuditItem label="Manual match" value={manualMatched ? "Linked with human confirmation" : "Open for review"} />
          <AuditItem label="Test email" value={acknowledged ? "Acknowledged without patient data" : "Pending acknowledgement"} />
          <AuditItem label="Redaction" value="Redacted by default" />
        </div>
        <p className="subtle">Synthetic audit trail only. No real patient data, raw claim documents, raw email bodies, or credentials.</p>
      </Panel>
    </main>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`ey-badge tone-${tone}`}>{children}</span>;
}
function Button({ children, primary = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button className={`ey-button ${primary ? "ey-button-primary" : "ey-button-secondary"}`} {...props}>{children}</button>;
}
function Panel({ title, kicker, action, children }: { title: string; kicker?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="ey-panel"><div className="ey-panel-head"><div>{kicker ? <p className="ey-kicker">{kicker}</p> : null}<h2>{title}</h2></div>{action ? <div className="ey-panel-action">{action}</div> : null}</div>{children}</section>;
}
function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className={`ey-stat tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function Readiness({ label, status, detail, tone }: { label: string; status: string; detail: string; tone: "good" | "warn" | "info" }) {
  return <div className="readiness-card"><div><span className={`ey-dot tone-${tone}`} /><strong>{label}</strong></div><Badge tone={tone}>{status}</Badge><p>{detail}</p></div>;
}
function EvidenceRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return <div><Badge tone={ok ? "good" : "blocked"}>{ok ? "Clear" : "Blocked"}</Badge><span>{label}</span><small>{detail}</small></div>;
}
function AuditItem({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
function Table({ headers, rows, compact = false }: { headers: string[]; rows: string[][]; compact?: boolean }) {
  return <div className={`table-wrap ${compact ? "compact" : ""}`}><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.slice(0, headers.length).map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
function QueuePanel({ title, count, value, detail, tone }: { title: string; count: string; value: string; detail: string; tone: "warn" | "info" | "bad" }) {
  return <Panel title={title} kicker="Ageing and TAT"><div className="queue-panel"><Badge tone={tone}>{count}</Badge><strong>{value}</strong><span>Owner ageing</span><p>{detail}</p></div></Panel>;
}
