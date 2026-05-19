"use client";

import { useEffect, useState, useTransition } from "react";
import type { ScraperJob } from "@/lib/scraperJobs";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [job, setJob] = useState<ScraperJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const saved = window.localStorage.getItem("r6-admin-password");
    if (saved) {
      setPassword(saved);
      void loadStatus(saved);
    }
  }, []);

  async function loadStatus(value = password) {
    if (!value) {
      return;
    }

    setMessage(null);
    const response = await fetch("/api/admin/scrape-request", {
      headers: {
        "x-admin-password": value,
      },
      cache: "no-store",
    });

    const body = await response.json();

    if (!response.ok) {
      setMessage(body.error ?? "Could not load scraper status.");
      return;
    }

    setJob(body.job);
  }

  function savePassword() {
    window.localStorage.setItem("r6-admin-password", password);
    void loadStatus(password);
  }

  function runScraper() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/admin/scrape-request", {
        method: "POST",
        headers: {
          "x-admin-password": password,
        },
      });
      const body = await response.json();

      if (!response.ok) {
        setMessage(body.error ?? "Could not request scraper run.");
        return;
      }

      setJob(body.job);
      setMessage("Scraper job queued. The mini PC worker will pick it up shortly.");
    });
  }

  return (
    <main className="adminShell">
      <section className="adminPanel">
        <p className="eyebrow">Admin</p>
        <h1>Scraper Control</h1>
        <p>
          Queue a local mini PC scrape after you finish playing. The Vercel app
          only stores the normalized results; the scraper still runs on your machine.
        </p>

        <label className="adminLabel">
          Admin password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="ADMIN_PASSWORD"
          />
        </label>

        <div className="heroActions">
          <button onClick={savePassword} type="button">
            Save Password
          </button>
          <button disabled={isPending || !password} onClick={runScraper} type="button">
            {isPending ? "Queueing..." : "Run Scraper Now"}
          </button>
          <button disabled={!password} onClick={() => void loadStatus()} type="button">
            Refresh Status
          </button>
        </div>

        {message ? <p className="status">{message}</p> : null}
      </section>

      <section className="panel">
        <h2>Latest Job</h2>
        {job ? (
          <div className="jobGrid">
            <Metric label="Status" value={job.status} />
            <Metric label="Requested" value={formatDate(job.requestedAt)} />
            <Metric label="Claimed" value={job.claimedAt ? formatDate(job.claimedAt) : "--"} />
            <Metric label="Finished" value={job.finishedAt ? formatDate(job.finishedAt) : "--"} />
            <Metric label="Run ID" value={job.runId ?? "--"} />
            <Metric label="Message" value={job.message ?? "--"} />
          </div>
        ) : (
          <p>No scraper jobs yet.</p>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
