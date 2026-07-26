import { useMemo, useState } from "react";
import { carriers } from "./data";

type Carrier = typeof carriers[number];

function BrandMark({ size = 34 }: { size?: number }) {
  const arm = "M48 28V6 M40.64 17.15L48 21.4l7.36-4.25 M42.37 9.75L48 13l5.63-3.25";
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-label="ColdProof">
      <g fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        {[0, 60, 120, 180, 240, 300].map((rotation) => <path key={rotation} transform={`rotate(${rotation} 48 48)`} d={arm} />)}
      </g>
      <path d="M39.7 47.8l5.1 6 11.5-11.5" fill="none" stroke="#0FB5D6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScoreRing({ value }: { value: number }) {
  return (
    <div className="score-ring">
      <div><strong>{value}</strong><span>/100</span></div>
    </div>
  );
}

function CarrierRow({ carrier, rank, onOpen }: { carrier: Carrier; rank: number; onOpen: () => void }) {
  return (
    <button className="carrier-row" onClick={onOpen} aria-label={`View ${carrier.displayName} score details`}>
      <span className="rank">{String(rank).padStart(2, "0")}</span>
      <span className="identity">
        <strong>{carrier.displayName}</strong>
        <span>{carrier.ensName}</span>
      </span>
      <span className={`grade grade-${carrier.grade.replace("+", "plus").toLowerCase()}`}>{carrier.grade}</span>
      <span className="row-score">{carrier.score}</span>
      <span className="arrow" aria-hidden="true">↗</span>
    </button>
  );
}

function Ranking({ title, eyebrow, items, onOpen }: {
  title: string; eyebrow: string; items: Carrier[]; onOpen: (carrier: Carrier) => void;
}) {
  return (
    <section className="ranking">
      <div className="ranking-head">
        <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
        <span className="count">{items.length} verified identities</span>
      </div>
      <div className="column-labels"><span>Rank / identity</span><span>Grade</span><span>Score</span></div>
      <div className="ranking-list">
        {items.map((carrier, index) => (
          <CarrierRow key={carrier.carrierId} carrier={carrier} rank={index + 1} onOpen={() => onOpen(carrier)} />
        ))}
      </div>
    </section>
  );
}

function Profile({ carrier, onClose }: { carrier: Carrier; onClose: () => void }) {
  return (
    <div className="profile-backdrop" role="presentation" onMouseDown={onClose}>
      <article className="profile" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close profile">×</button>
        <span className="eyebrow">{carrier.carrierId} · {carrier.carrierType === "transport_company" ? "Company" : "Freelancer"}</span>
        <div className="profile-top">
          <div><h2 id="profile-title">{carrier.displayName}</h2><a href={carrier.ensProfileUrl} target="_blank" rel="noreferrer">{carrier.ensName} ↗</a></div>
          <ScoreRing value={carrier.score} />
        </div>
        <div className="profile-grade"><span>ColdProof grade</span><strong>{carrier.grade}</strong><small>Model v1.0 · ENS verified snapshot</small></div>
        <div className="metrics">
          <div><span>Compliance</span><strong>{carrier.complianceRate.toFixed(2)}%</strong></div>
          <div><span>On time</span><strong>{carrier.onTimeRate.toFixed(2)}%</strong></div>
          <div><span>Completion</span><strong>{carrier.completionRate.toFixed(2)}%</strong></div>
          <div><span>Shipments</span><strong>{carrier.totalShipments.toLocaleString()}</strong></div>
        </div>
        <div className="profile-footer"><span>{carrier.incidents} incidents recorded</span><a href={carrier.ensProfileUrl} target="_blank" rel="noreferrer">Open ENS profile</a></div>
      </article>
    </div>
  );
}

export function App() {
  const [selected, setSelected] = useState<Carrier | null>(null);
  const companies = useMemo(() => carriers.filter((item) => item.carrierType === "transport_company"), []);
  const freelancers = useMemo(() => carriers.filter((item) => item.carrierType === "freelance_carrier"), []);
  return (
    <main>
      <header>
        <a className="brand" href="#"><BrandMark /><span>Cold<span>Proof</span></span></a>
        <div className="network"><i /> Sepolia · ENSv2</div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Cold-chain reputation layer</span>
          <h1>Proof of delivery is not proof of <em>safe</em> delivery.</h1>
          <p>Comparable performance. Verifiable identity. One transparent score for every carrier moving temperature-sensitive goods.</p>
        </div>
        <div className="hero-proof">
          <div className="thermometer"><span /><b>2–8°C</b></div>
          <p>Reputation snapshots anchored to <a href="https://app.ens.dev/coldproof.eth" target="_blank" rel="noreferrer">coldproof.eth ↗</a></p>
        </div>
      </section>
      <div className="demo-note"><span>ENS verified</span> Reputation scores and supporting metrics are published on Sepolia under each carrier identity.</div>
      <section className="rankings">
        <Ranking eyebrow="Fleet operators" title="Transport companies" items={companies} onOpen={setSelected} />
        <Ranking eyebrow="Independent carriers" title="Freelancers" items={freelancers} onOpen={setSelected} />
      </section>
      <footer><span>ColdProof Score Engine · v1.0</span><span>50% compliance · 30% on-time · 20% completion</span></footer>
      {selected && <Profile carrier={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
