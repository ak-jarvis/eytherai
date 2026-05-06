"use client";

import { useEffect, useMemo, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";
const INVITE_ID = "INVITE-TEST-0001";
const SYNTHETIC_OTP = "000000";

const claim = {
  id: "CLM-TEST-0001",
  patient: "Test Patient Alpha",
  owner: "Insurance Desk Test Owner",
  insurerOrTpa: "Example TPA Sandbox",
  amount: "INR 1,25,000",
  status: "Awaiting evidence",
  branch: "Main cashless desk",
  stage: "Cashless pre-auth",
};

const worklistRows = [
  [
    claim.id,
    claim.patient,
    claim.insurerOrTpa,
    "Cashless pre-auth",
    claim.owner,
    "Open",
    "02h 20m",
    claim.amount,
    claim.status,
  ],
  [
    "CLM-TEST-0002",
    "Test Patient Beta",
    "Example Insurer Desk",
    "Query response",
    "Billing Test Owner",
    "Pending",
    "1 day",
    "INR 84,000",
    "Doctor note pending",
  ],
  [
    "CLM-TEST-0003",
    "Test Patient Gamma",
    "Example Scheme Authority",
    "Final settlement",
    "Finance Test Owner",
    "Open",
    "4 days",
    "INR 2,18,000",
    "Short payment review",
  ],
];

const manualRows = [
  [
    "Test email acknowledgement for CLM-TEST-0001",
    "10:42",
    claim.id,
    "74%",
    "Needs manual match",
  ],
  [
    "Synthetic settlement advice row",
    "09:30",
    "CLM-TEST-0003",
    "61%",
    "Amount mismatch",
  ],
  [
    "Portal export upload",
    "Yesterday",
    "No match",
    "28%",
    "Counterparty reference missing",
  ],
];

const financeRows = [
  ["Outstanding ageing 0-2 days", "8", "INR 5.2L", "Insurance desk follow-up"],
  ["Outstanding ageing 3-7 days", "4", "INR 7.1L", "Escalate query evidence"],
  [
    "Outstanding ageing 8+ days",
    "2",
    "INR 6.1L",
    "Billing and finance recovery review",
  ],
];

const timelineRows = [
  [
    "11:10",
    "Cashless pre-auth draft created",
    "Created by claim officer with masked patient token.",
  ],
  [
    "10:42",
    "Test email acknowledgement received",
    "No patient data in acknowledgement evidence.",
  ],
  [
    "09:35",
    "Query response held",
    "Doctor note and tariff proof pending reviewer check.",
  ],
  [
    "Yesterday",
    "Short payment marked for billing review",
    "Payment advice artifact still redacted.",
  ],
];

type AuthUser = {
  user_id: string;
  name: string;
  roles: string[];
  branch_scope: { all_branches: boolean; branch_ids: string[] };
};

type AuthStatus = "pending" | "starting" | "signed_in" | "error";

function usePhaseSession() {
  const [apiLive, setApiLive] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("pending");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/health`, { signal: controller.signal })
      .then((response) => setApiLive(response.ok))
      .catch(() => setApiLive(false));
    return () => controller.abort();
  }, []);

  async function acceptInvite() {
    setAuthStatus("starting");
    try {
      const invite = await fetch(`${API_BASE}/invites/${INVITE_ID}`, {
        credentials: "include",
      });
      if (!invite.ok) throw new Error("Invite read failed");

      const accepted = await fetch(`${API_BASE}/invites/${INVITE_ID}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "Insurance Desk Test Owner",
          phone: null,
          otp: SYNTHETIC_OTP,
        }),
      });
      const verifyPayload = await accepted.json();
      if (!accepted.ok)
        throw new Error(verifyPayload?.message ?? "Invite acceptance failed");

      setAuthUser(verifyPayload.data.user);
      setAuthStatus("signed_in");
    } catch {
      setAuthStatus("error");
    }
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setAuthUser(null);
      setAuthStatus("pending");
    }
  }

  return { apiLive, authStatus, authUser, acceptInvite, logout };
}

export default function Home() {
  return (
    <PhaseShell
      active="overview"
      title="Unified cashless claims dashboard"
      description="Lotus Valley Test Hospital | insurance desk | synthetic local build"
    >
      <section className="metric-grid">
        <Stat
          label="Claims worklist"
          value="14"
          detail="Open cashless claims across pre-auth, query, and settlement"
          tone="info"
        />
        <Stat
          label="Manual match queue"
          value="5"
          detail="Email or portal events needing claim officer confirmation"
          tone="warn"
        />
        <Stat
          label="Owner ageing"
          value="INR 18.4L"
          detail="Pending TAT movement for claim owners"
          tone="bad"
        />
        <Stat
          label="Active Send"
          value="Blocked"
          detail="Reviewer-gated live evidence required"
          tone="blocked"
        />
      </section>

      <section className="workspace-grid">
        <Panel title="Today’s Claim Desk" kicker="Operating view">
          <Table
            headers={[
              "Claim",
              "Patient",
              "Insurer / TPA",
              "Stage",
              "Owner",
              "State",
              "TAT",
              "Amount",
              "Status",
            ]}
            rows={worklistRows}
          />
        </Panel>
        <Panel title="Route Safety" kicker="No-patient-data build">
          <div className="status-callout">
            <Badge tone="blocked">Active Send blocked</Badge>
            <strong>Draft-only local workflow</strong>
            <span>
              Live Send waits for exact hospital x insurer / TPA / scheme
              authority evidence and no-patient-data acknowledgement.
            </span>
          </div>
          <div className="evidence-list">
            <EvidenceRow
              ok
              label="Synthetic fixtures"
              detail="No raw claim documents, email bodies, mailbox screenshots, or identifiers."
            />
            <EvidenceRow
              ok={false}
              label="Live counterparty evidence"
              detail="Reviewer must approve before active submission."
            />
            <EvidenceRow
              ok
              label="Redaction posture"
              detail="Patient and policy identifiers are masked by default."
            />
          </div>
        </Panel>
      </section>

      <section className="panel-row">
        <QueuePanel
          title="Claim Officer Home"
          count="9 active"
          value="Worklist first"
          detail="Fast triage for cashless pre-auth, query, enhancement, and settlement tasks"
          tone="info"
        />
        <QueuePanel
          title="Hospital Admin"
          count="4 gates"
          value="Setup ready"
          detail="Readiness cards keep mailbox, evidence, roles, and counterparty routes visible"
          tone="warn"
        />
        <QueuePanel
          title="Finance View"
          count="3 buckets"
          value="Redacted CSV"
          detail="Outstanding ageing and settlement export stay free of real patient data"
          tone="bad"
        />
      </section>
    </PhaseShell>
  );
}

export function SetupPage() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [counterpartyEvidence, setCounterpartyEvidence] = useState(false);
  const [payerMixChecked, setPayerMixChecked] = useState(false);

  return (
    <PhaseShell
      active="setup"
      title="Setup and onboarding readiness"
      description="Hospital profile, mailbox readiness, counterparty evidence, and no-patient-data test email"
    >
      <section className="metric-grid">
        <Stat
          label="Hospital profile"
          value="Ready"
          detail="Synthetic branch and insurance-desk roles captured"
          tone="info"
        />
        <Stat
          label="Mailbox"
          value="Connected"
          detail="Metadata-only test mode, no raw email bodies"
          tone="good"
        />
        <Stat
          label="Counterparties"
          value="2 blocked"
          detail="Live Send waits for hospital-specific route proof"
          tone="warn"
        />
        <Stat
          label="No-patient-data"
          value={acknowledged ? "Ack" : "Pending"}
          detail="Test email acknowledgement gate"
          tone={acknowledged ? "info" : "blocked"}
        />
      </section>

      <section className="workspace-grid">
        <Panel title="Onboarding Readiness" kicker="Go-live gates">
          <div className="readiness-grid">
            <Readiness
              label="Hospital profile"
              status="Ready"
              detail="Branch, claim owner, and support escalation contacts are captured as synthetic records."
              tone="good"
            />
            <Readiness
              label="User access"
              status="Ready"
              detail="Hospital admin, claim officer, billing/finance, owner, auditor, and support roles are represented."
              tone="good"
            />
            <Readiness
              label="Insurer / TPA mix"
              status={payerMixChecked ? "Checked" : "Needs import"}
              detail="Only anonymised payer-mix rows are allowed during onboarding."
              tone={payerMixChecked ? "good" : "warn"}
            />
            <Readiness
              label="Live Send route"
              status="Blocked"
              detail="Exact hospital x counterparty route evidence is required before submission."
              tone="warn"
            />
          </div>
          <div className="button-row">
            <Button onClick={() => setPayerMixChecked(true)}>
              Mark payer-mix headers checked
            </Button>
            <Button onClick={() => setCounterpartyEvidence(true)}>
              Attach route evidence
            </Button>
          </div>
        </Panel>

        <Panel title="Mailbox And Test Email" kicker="No raw bodies">
          <div className="mailbox-box">
            <div>
              <span>Status</span>
              <strong>Connected</strong>
            </div>
            <div>
              <span>Test email</span>
              <strong>{acknowledged ? "Acknowledged" : "Pending"}</strong>
            </div>
            <div>
              <span>Raw body capture</span>
              <strong>Off</strong>
            </div>
            <div>
              <span>Active Send</span>
              <strong>Blocked</strong>
            </div>
          </div>
          <div className="test-email-controls">
            <Button
              data-testid="test-email-acknowledgement"
              onClick={() => setAcknowledged(true)}
              primary
            >
              Acknowledge test email
            </Button>
            <Button onClick={() => setAcknowledged(false)}>
              Reset acknowledgement
            </Button>
          </div>
          <p className="subtle">
            {acknowledged
              ? "Acknowledged test email - no patient data - synthetic only."
              : "Test email controls are no-PII and do not send real mail."}
          </p>
        </Panel>
      </section>

      <Panel
        title="Counterparty Readiness Matrix"
        kicker="Insurer / TPA / scheme authority"
      >
        <Table
          headers={["Counterparty", "Type", "Route", "Evidence", "Send state"]}
          rows={[
            [
              "Example TPA Sandbox",
              "TPA",
              "Email test route",
              "No-patient-data acknowledgement",
              "Draft only",
            ],
            [
              "Example Insurer Desk",
              "Insurer",
              "Email",
              counterpartyEvidence
                ? "Synthetic route evidence attached"
                : "Hospital-specific instruction missing",
              "Blocked",
            ],
            [
              "Example Scheme Authority",
              "Scheme authority",
              "Portal",
              "Manual portal proof and acknowledgement required",
              "Blocked",
            ],
          ]}
        />
      </Panel>
    </PhaseShell>
  );
}

export function WorklistPage() {
  const [stage, setStage] = useState("All");
  const rows = useMemo(
    () => worklistRows.filter((row) => stage === "All" || row[3] === stage),
    [stage],
  );

  return (
    <PhaseShell
      active="worklist"
      title="Claim officer worklist"
      description="Cashless claim tasks by owner, TAT, insurer / TPA, and next action"
    >
      <section className="metric-grid">
        <Stat
          label="Open pre-auth"
          value="6"
          detail="Draft, review, or Send-blocked packets"
          tone="info"
        />
        <Stat
          label="Query responses"
          value="5"
          detail="Doctor note or tariff proof pending"
          tone="warn"
        />
        <Stat
          label="Final settlement"
          value="3"
          detail="Payment advice and short payment review"
          tone="bad"
        />
        <Stat
          label="Blocked Send"
          value="3"
          detail="Missing counterparty evidence"
          tone="blocked"
        />
      </section>

      <Panel
        title="Claims Worklist"
        kicker="Claim officer operating home"
        action={
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            aria-label="Filter worklist stage"
          >
            {[
              "All",
              "Cashless pre-auth",
              "Query response",
              "Final settlement",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        }
      >
        <Table
          headers={[
            "Claim",
            "Patient",
            "Insurer / TPA",
            "Stage",
            "Owner",
            "State",
            "TAT",
            "Amount",
            "Status",
          ]}
          rows={rows}
        />
      </Panel>

      <section className="panel-row">
        <QueuePanel
          title="My Open Queue"
          count="8 open"
          value="02h 20m"
          detail="Next TAT movement is the cashless pre-auth packet for CLM-TEST-0001"
          tone="info"
        />
        <QueuePanel
          title="Needs Doctor Input"
          count="5 pending"
          value="INR 4.7L"
          detail="Query response packets cannot move without clinical notes"
          tone="warn"
        />
        <QueuePanel
          title="Finance Review"
          count="3 open"
          value="INR 6.9L"
          detail="Short payment and settlement rows need billing/finance review"
          tone="bad"
        />
      </section>
    </PhaseShell>
  );
}

export function NewClaimPage() {
  const [draftSaved, setDraftSaved] = useState(false);
  const [documentsChecked, setDocumentsChecked] = useState(false);

  return (
    <PhaseShell
      active="new-claim"
      title="New cashless pre-auth filing"
      description="Create a draft packet, map documents, and hold Send until counterparty evidence passes"
    >
      <section className="workspace-grid">
        <Panel title="Claim Filing Form" kicker="Draft only">
          <div className="claim-form">
            <label className="field">
              <span>Patient display token</span>
              <input value="PT-TEST-ALPHA" readOnly />
            </label>
            <label className="field">
              <span>Insurer / TPA / scheme authority</span>
              <select defaultValue="Example TPA Sandbox">
                <option>Example TPA Sandbox</option>
                <option>Example Insurer Desk</option>
                <option>Example Scheme Authority</option>
              </select>
            </label>
            <label className="field">
              <span>Admission type</span>
              <select defaultValue="Planned">
                <option>Planned</option>
                <option>Emergency</option>
              </select>
            </label>
            <label className="field">
              <span>Requested amount</span>
              <input value="INR 1,25,000" readOnly />
            </label>
            <label className="field field-wide">
              <span>Treatment summary</span>
              <textarea
                value="Synthetic treatment summary only. No real diagnosis, reports, or patient identifiers."
                readOnly
              />
            </label>
          </div>
          <div className="button-row">
            <Button onClick={() => setDraftSaved(true)} primary>
              Save draft
            </Button>
            <Button disabled>Submit for live Send</Button>
          </div>
          <p className="subtle">
            {draftSaved
              ? "Draft saved in the local synthetic flow."
              : "Draft can be saved without enabling live submission."}
          </p>
        </Panel>

        <Panel title="Packet Checklist" kicker="Document map">
          <div className="document-grid">
            <ChecklistItem
              ok
              label="Pre-auth form"
              detail="Synthetic packet field map ready."
            />
            <ChecklistItem
              ok={documentsChecked}
              label="Clinical note"
              detail="Claim officer must confirm no real document upload."
            />
            <ChecklistItem
              ok={documentsChecked}
              label="Tariff / package proof"
              detail="Required for query and short payment review."
            />
            <ChecklistItem
              ok={false}
              label="Live route proof"
              detail="Reviewer-gated; Active Send remains blocked."
            />
          </div>
          <div className="button-row">
            <Button onClick={() => setDocumentsChecked(true)}>
              Mark synthetic documents checked
            </Button>
          </div>
        </Panel>
      </section>

      <Panel title="Submission Guard" kicker="Active Send">
        <div className="status-callout">
          <Badge tone="blocked">Blocked</Badge>
          <strong>Live Send cannot be enabled from the public baseline</strong>
          <span>
            Exact hospital x insurer / TPA / scheme authority route evidence and
            no-patient-data acknowledgement are mandatory before active
            submission.
          </span>
        </div>
      </Panel>
    </PhaseShell>
  );
}

export function ClaimDetailPage() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [evidenceAttached, setEvidenceAttached] = useState(false);
  const [noPatientConfirmed, setNoPatientConfirmed] = useState(false);
  const activeSendEvidenceCaptured =
    acknowledged && evidenceAttached && noPatientConfirmed;

  return (
    <PhaseShell
      active="claim"
      title="Live claim flow"
      description={`${claim.id} | ${claim.stage} | ${claim.insurerOrTpa}`}
    >
      <section className="metric-grid">
        <Stat
          label="Claim value"
          value={claim.amount}
          detail="Synthetic cashless pre-auth amount"
          tone="info"
        />
        <Stat
          label="Current stage"
          value="Pre-auth"
          detail="Awaiting evidence review"
          tone="warn"
        />
        <Stat label="Owner" value="Desk" detail={claim.owner} tone="info" />
        <Stat
          label="Active Send"
          value="Blocked"
          detail="Live evidence guard is binding"
          tone="blocked"
        />
      </section>

      <section className="workspace-grid">
        <Panel title="Active Send Evidence" kicker={claim.id}>
          <div className="status-callout">
            <Badge tone="blocked">Blocked</Badge>
            <strong>
              {activeSendEvidenceCaptured
                ? "Synthetic evidence captured - live Send still blocked"
                : "Missing evidence - acknowledgement required"}
            </strong>
            <span>
              Active Send remains draft-only until exact hospital x insurer /
              TPA / scheme authority evidence exists.
            </span>
          </div>
          <div className="draft-grid">
            <div>
              <span>Claim</span>
              <strong>{claim.id}</strong>
            </div>
            <div>
              <span>Patient display</span>
              <strong>{claim.patient}</strong>
            </div>
            <div>
              <span>Owner</span>
              <strong>{claim.owner}</strong>
            </div>
            <div>
              <span>Counterparty</span>
              <strong>{claim.insurerOrTpa}</strong>
            </div>
          </div>
          <div className="evidence-list">
            <EvidenceRow
              ok={evidenceAttached}
              label="Hospital x counterparty route evidence"
              detail="Synthetic setup artifact attached"
            />
            <EvidenceRow
              ok={acknowledged}
              label="Test email acknowledgement"
              detail="No patient data confirmation recorded"
            />
            <EvidenceRow
              ok={noPatientConfirmed}
              label="No patient data confirmation"
              detail="Reviewer-visible safety gate"
            />
          </div>
          <div className="button-row">
            <Button
              data-testid="attach-send-evidence"
              onClick={() => {
                setEvidenceAttached(true);
                setAcknowledged(true);
              }}
            >
              Attach evidence
            </Button>
            <Button
              data-testid="confirm-no-patient-data"
              onClick={() => setNoPatientConfirmed(true)}
            >
              Confirm no patient data
            </Button>
            <Button disabled primary>
              Active Send
            </Button>
          </div>
        </Panel>

        <Panel title="Claim Packet" kicker="Cashless pre-auth">
          <div className="document-grid">
            <ChecklistItem
              ok
              label="Draft packet"
              detail="Pre-auth fields are ready for review."
            />
            <ChecklistItem
              ok
              label="Masked patient snapshot"
              detail="Display token only in local build."
            />
            <ChecklistItem
              ok={false}
              label="Attachment route"
              detail="Counterparty limits not verified for live use."
            />
            <ChecklistItem
              ok={false}
              label="Portal fallback"
              detail="Manual portal acknowledgement still required."
            />
          </div>
        </Panel>
      </section>

      <section className="workspace-grid">
        <Panel title="Claim Timeline" kicker="Lifecycle and TAT">
          <Timeline rows={timelineRows} />
        </Panel>
        <Panel title="Next Actions" kicker="Query / enhancement / settlement">
          <div className="step-list">
            <StepItem
              label="Query response"
              state="Needs doctor note"
              detail="Claim officer can prepare a draft response packet."
            />
            <StepItem
              label="Enhancement"
              state="Available as draft"
              detail="No live submission until counterparty evidence is approved."
            />
            <StepItem
              label="Final claim"
              state="Not started"
              detail="Settlement packet will require payment advice evidence."
            />
            <StepItem
              label="Close claim"
              state="Blocked"
              detail="Low-confidence parser output cannot close terminal states."
            />
          </div>
        </Panel>
      </section>
    </PhaseShell>
  );
}

export function ManualMatchPage() {
  const [manualMatched, setManualMatched] = useState(false);

  return (
    <PhaseShell
      active="manual-match"
      title="Unmatched mailbox queue"
      description="Human confirmation for test email and portal events before claim linkage"
    >
      <section className="workspace-grid">
        <Panel title="Manual Match Queue" kicker="Unmatched test email">
          <Table
            headers={[
              "Event",
              "Received",
              "Possible claim",
              "Confidence",
              "Blocker",
            ]}
            rows={manualRows}
            compact
          />
          <div className="button-row">
            <Button
              data-testid="manual-match-email"
              onClick={() => setManualMatched(true)}
              primary
            >
              Manual match email
            </Button>
          </div>
          <p className="subtle">
            {manualMatched
              ? `Matched and linked to ${claim.id}.`
              : "Unmatched test email needs claim officer confirmation."}
          </p>
        </Panel>

        <Panel title="Match Evidence" kicker="No raw email bodies">
          <div className="evidence-list">
            <EvidenceRow
              ok
              label="Subject"
              detail="Test email acknowledgement for CLM-TEST-0001"
            />
            <EvidenceRow
              ok
              label="Sender domain"
              detail="Synthetic .test mailbox metadata only"
            />
            <EvidenceRow
              ok={manualMatched}
              label="Human confirmation"
              detail={
                manualMatched
                  ? "Claim officer linked the event."
                  : "Waiting for manual match."
              }
            />
          </div>
        </Panel>
      </section>

      <Panel title="Ignored Or Quarantined" kicker="Reviewer-safe queue">
        <Table
          headers={["Event", "Reason", "Action", "Audit"]}
          rows={[
            [
              "Portal export upload",
              "Counterparty reference missing",
              "Keep unmatched",
              "No patient data captured",
            ],
            [
              "Synthetic settlement advice row",
              "Amount mismatch",
              "Manual review",
              "Billing/finance owner notified",
            ],
          ]}
        />
      </Panel>
    </PhaseShell>
  );
}

export function OwnersPage() {
  return (
    <PhaseShell
      active="owners"
      title="Owner summary and ageing"
      description="Doctor-owner, insurance desk, billing, and finance accountability without patient identifiers"
    >
      <section className="panel-row">
        <QueuePanel
          title="Owner Summary"
          count="14 open"
          value="INR 18.4L"
          detail={`${claim.owner} has pending TAT movement`}
          tone="warn"
        />
        <QueuePanel
          title="Queries"
          count="7 pending"
          value="INR 8.4L"
          detail="Doctor note, tariff proof, discharge summary"
          tone="info"
        />
        <QueuePanel
          title="Final Settlements"
          count="4 open"
          value="INR 6.9L"
          detail="Settlement and payment advice review"
          tone="bad"
        />
      </section>

      <Panel title="Owner Work Distribution" kicker="Ageing and TAT">
        <Table
          headers={[
            "Owner",
            "Role",
            "Open claims",
            "Oldest TAT",
            "Value",
            "Next action",
          ]}
          rows={[
            [
              claim.owner,
              "Claim officer",
              "8",
              "02h 20m",
              "INR 8.9L",
              "Prepare pre-auth and query packets",
            ],
            [
              "Billing Test Owner",
              "Billing / finance",
              "4",
              "4 days",
              "INR 6.1L",
              "Review short payment and settlement advice",
            ],
            [
              "Doctor Owner Token",
              "Doctor reviewer",
              "2",
              "1 day",
              "INR 3.4L",
              "Provide clinical note for query response",
            ],
          ]}
        />
      </Panel>
    </PhaseShell>
  );
}

export function FinanceExportPage() {
  function downloadFinanceExport() {
    const csv = [
      "claim_id,owner,insurer_or_tpa,claim_value_inr,status,redaction_status",
      `${claim.id},${claim.owner},${claim.insurerOrTpa},125000,synthetic settlement,redacted`,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "synthetic-finance-export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <PhaseShell
      active="finance"
      title="Finance export"
      description="Redacted outstanding ageing, settlement, and payment advice export"
    >
      <section className="workspace-grid">
        <Panel title="Settlement Export" kicker="Payment advice">
          <div className="finance-head">
            <strong>INR 18.4L</strong>
            <span>Redacted settlement file</span>
          </div>
          <Table
            headers={["Bucket", "Claims", "Value", "Next step"]}
            rows={financeRows}
            compact
          />
          <div className="button-row">
            <Button
              data-testid="download-finance-export"
              onClick={downloadFinanceExport}
              primary
            >
              Download finance export CSV
            </Button>
          </div>
          <div className="blocked-state">
            <Badge tone="good">Redacted</Badge>
            <span>
              Export excludes patient and policy identifiers until reveal is
              approved.
            </span>
          </div>
        </Panel>

        <Panel title="Export Controls" kicker="Billing / finance">
          <div className="evidence-list">
            <EvidenceRow
              ok
              label="CSV redaction"
              detail="No patient, policy, raw document, or raw email fields."
            />
            <EvidenceRow
              ok
              label="Audit row"
              detail="Download intent is visible to reviewer evidence."
            />
            <EvidenceRow
              ok={false}
              label="Sensitive reveal"
              detail="Reveal requires an audited reason and permission."
            />
          </div>
        </Panel>
      </section>
    </PhaseShell>
  );
}

export function AuditPage() {
  return (
    <PhaseShell
      active="audit"
      title="Audit and reveal evidence"
      description="Reviewer-facing evidence for redaction, Active Send, manual match, and access decisions"
    >
      <Panel title="Audit And Redaction Evidence" kicker="Reviewer evidence">
        <div className="audit-grid">
          <AuditItem label="Active Send" value="Blocked until live evidence" />
          <AuditItem label="Manual match" value="Human confirmation required" />
          <AuditItem
            label="Test email"
            value="No patient data acknowledgement"
          />
          <AuditItem label="Redaction" value="Redacted by default" />
        </div>
        <p className="subtle">
          Synthetic audit trail only. No real patient data, raw claim documents,
          raw email bodies, or credentials.
        </p>
      </Panel>

      <section className="workspace-grid">
        <Panel title="Reveal Controls" kicker="Sensitive data">
          <div className="step-list">
            <StepItem
              label="Raw email reveal"
              state="Unavailable"
              detail="Raw email bodies are not captured in the local build."
            />
            <StepItem
              label="Document reveal"
              state="Unavailable"
              detail="No raw claim documents are stored or rendered."
            />
            <StepItem
              label="Audit reason"
              state="Required"
              detail="Any future reveal must record role, reason, and reviewer-visible evidence."
            />
          </div>
        </Panel>
        <Panel title="Evidence Events" kicker={claim.id}>
          <Timeline
            rows={[
              [
                "11:10",
                "Invite session created",
                "Hospital user access through synthetic invite.",
              ],
              [
                "10:42",
                "Test email acknowledged",
                "No-patient-data evidence captured.",
              ],
              [
                "09:55",
                "Active Send blocked",
                "Missing live hospital x counterparty evidence.",
              ],
              [
                "09:30",
                "Finance export redacted",
                "Settlement CSV excludes sensitive identifiers.",
              ],
            ]}
          />
        </Panel>
      </section>
    </PhaseShell>
  );
}

function PhaseShell({
  active,
  title,
  description,
  children,
}: {
  active: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { apiLive, authStatus, authUser, acceptInvite, logout } =
    usePhaseSession();
  const loggedIn = authStatus === "signed_in";
  const roleText =
    authUser?.roles.join(", ") ?? "hospital_admin, claim_officer";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="ey-kicker">Eyther Phase 1</p>
          <h1>{title}</h1>
          <p className="subtle">
            {description} | API {API_BASE}
          </p>
        </div>
        <div className="topbar-actions">
          <Badge tone={apiLive ? "good" : "warn"}>
            {apiLive ? "Live API" : "Demo fallback"}
          </Badge>
          <Button
            data-testid="accept-invite"
            onClick={acceptInvite}
            disabled={authStatus === "starting"}
            primary
          >
            {loggedIn
              ? "Signed in"
              : authStatus === "starting"
                ? "Signing in"
                : "Accept invite"}
          </Button>
          {loggedIn ? (
            <Button data-testid="logout" onClick={logout}>
              Sign out
            </Button>
          ) : null}
        </div>
      </header>

      <nav className="route-tabs" aria-label="Phase 1 sections">
        {[
          ["overview", "/", "Overview"],
          ["setup", "/setup", "Setup"],
          ["worklist", "/worklist", "Worklist"],
          ["new-claim", "/claims/new", "New claim"],
          ["claim", `/claims/${claim.id}`, "Live claim"],
          ["manual-match", "/mailbox/unmatched", "Manual match"],
          ["owners", "/owners", "Owners"],
          ["finance", "/finance/export", "Finance"],
          ["audit", `/claims/${claim.id}/audit`, "Audit"],
        ].map(([key, href, label]) => (
          <a
            key={key}
            href={href}
            className={active === key ? "is-active" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>

      <section className="login-strip">
        <div>
          <span>Invite / login</span>
          <strong>
            {loggedIn
              ? `${authUser?.name ?? "Insurance desk"} signed in`
              : authStatus === "error"
                ? "Login needs API"
                : "Synthetic invite pending"}
          </strong>
          <small>
            {loggedIn
              ? `Roles: ${roleText} | Branch scope: all branches`
              : "API-backed invite and session cookie flow"}
          </small>
        </div>
        <div>
          <span>User access</span>
          <strong>{loggedIn ? "Role checked" : "Awaiting invite"}</strong>
          <small>
            Hospital admin, claim officer, billing/finance, owner, auditor,
            support
          </small>
        </div>
        <div>
          <span>Active Send</span>
          <strong>Blocked</strong>
          <small>
            Live Send requires exact hospital x counterparty evidence and
            reviewer approval
          </small>
        </div>
      </section>

      {children}
    </main>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`ey-badge tone-${tone}`}>{children}</span>;
}

function Button({
  children,
  primary = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      className={`ey-button ${primary ? "ey-button-primary" : "ey-button-secondary"}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  kicker,
  action,
  children,
}: {
  title: string;
  kicker?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ey-panel">
      <div className="ey-panel-head">
        <div>
          {kicker ? <p className="ey-kicker">{kicker}</p> : null}
          <h2>{title}</h2>
        </div>
        {action ? <div className="ey-panel-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className={`ey-stat tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Readiness({
  label,
  status,
  detail,
  tone,
}: {
  label: string;
  status: string;
  detail: string;
  tone: "good" | "warn" | "info";
}) {
  return (
    <div className="readiness-card">
      <div>
        <span className={`ey-dot tone-${tone}`} />
        <strong>{label}</strong>
      </div>
      <Badge tone={tone}>{status}</Badge>
      <p>{detail}</p>
    </div>
  );
}

function EvidenceRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div>
      <Badge tone={ok ? "good" : "blocked"}>{ok ? "Clear" : "Blocked"}</Badge>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function ChecklistItem({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="checklist-item">
      <Badge tone={ok ? "good" : "warn"}>{ok ? "Ready" : "Needs review"}</Badge>
      <strong>{label}</strong>
      <span>{detail}</span>
    </div>
  );
}

function AuditItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StepItem({
  label,
  state,
  detail,
}: {
  label: string;
  state: string;
  detail: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{state}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Timeline({ rows }: { rows: string[][] }) {
  return (
    <ol className="timeline">
      {rows.map(([time, event, detail]) => (
        <li key={`${time}-${event}`}>
          <span>{time}</span>
          <div>
            <strong>
              {claim.id} - {event}
            </strong>
            <small>{detail}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Table({
  headers,
  rows,
  compact = false,
}: {
  headers: string[];
  rows: string[][];
  compact?: boolean;
}) {
  return (
    <div className={`table-wrap ${compact ? "compact" : ""}`}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.slice(0, headers.length).map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueuePanel({
  title,
  count,
  value,
  detail,
  tone,
}: {
  title: string;
  count: string;
  value: string;
  detail: string;
  tone: "warn" | "info" | "bad";
}) {
  return (
    <Panel title={title} kicker="Ageing and TAT">
      <div className="queue-panel">
        <Badge tone={tone}>{count}</Badge>
        <strong>{value}</strong>
        <span>Owner ageing</span>
        <p>{detail}</p>
      </div>
    </Panel>
  );
}
