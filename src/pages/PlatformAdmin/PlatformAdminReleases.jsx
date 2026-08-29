import {
  useState,
} from "react";

import {
  CheckCircle2,
  ExternalLink,
  Rocket,
  ShieldCheck,
} from "lucide-react";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import {
  deployCampaignSeatApp,
} from "../../services/platformRelease";

import styles
  from "./PlatformAdminReleases.module.css";

const APP_URL =
  "https://app.campaignseat.com";

const RELEASE_BRANCH =
  "work/patrick-demo-foundation-20260820";

export default function PlatformAdminReleases() {
  const [
    releaseNote,
    setReleaseNote,
  ] = useState("");

  const [
    confirmation,
    setConfirmation,
  ] = useState("");

  const [
    deploying,
    setDeploying,
  ] = useState(false);

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const confirmed =
    confirmation.trim().toUpperCase() ===
    "DEPLOY";

  const deploy = async () => {
    if (!confirmed || deploying) {
      return;
    }

    setDeploying(true);
    setError("");
    setResult(null);

    try {
      const response =
        await deployCampaignSeatApp({
          releaseNote,
        });

      setResult(response);
      setConfirmation("");
    } catch (releaseError) {
      setError(
        releaseError instanceof Error
          ? releaseError.message
          : "The App release could not be started.",
      );
    } finally {
      setDeploying(false);
    }
  };

  return (
    <PlatformAdminShell
      title="Release Center"
      description="Control production releases of the Campaign Seat client application."
    >
      <div className={styles.page}>
        <section className={styles.statusCard}>
          <div className={styles.statusTop}>
            <div>
              <span className={styles.eyebrow}>
                Campaign Seat App
              </span>

              <h2>
                Production
              </h2>
            </div>

            <span className={styles.ready}>
              <CheckCircle2 size={16} />
              Manual release
            </span>
          </div>

          <dl className={styles.details}>
            <div>
              <dt>Destination</dt>
              <dd>
                <a
                  href={APP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  app.campaignseat.com
                  <ExternalLink size={14} />
                </a>
              </dd>
            </div>

            <div>
              <dt>Release branch</dt>
              <dd>{RELEASE_BRANCH}</dd>
            </div>

            <div>
              <dt>Release policy</dt>
              <dd>
                Admin approval required
              </dd>
            </div>

            <div>
              <dt>Security</dt>
              <dd>
                Platform role + MFA
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.releaseCard}>
          <div className={styles.sectionHeading}>
            <div className={styles.icon}>
              <Rocket size={21} />
            </div>

            <div>
              <h2>
                Deploy App Update
              </h2>

              <p>
                Release the current approved Git branch
                to the Campaign Seat client application.
              </p>
            </div>
          </div>

          <label className={styles.field}>
            Release note
            <textarea
              value={releaseNote}
              onChange={(event) =>
                setReleaseNote(
                  event.target.value,
                )
              }
              maxLength={500}
              rows={4}
              placeholder="Example: Calendar scheduling improvements"
            />
          </label>

          <div className={styles.warning}>
            <ShieldCheck size={19} />

            <div>
              <strong>
                Production deployment
              </strong>

              <span>
                This updates the software used by
                Campaign Seat clients.
              </span>
            </div>
          </div>

          <label className={styles.field}>
            Type DEPLOY to confirm

            <input
              value={confirmation}
              onChange={(event) =>
                setConfirmation(
                  event.target.value,
                )
              }
              autoComplete="off"
              placeholder="DEPLOY"
            />
          </label>

          <button
            className={styles.deployButton}
            type="button"
            disabled={
              !confirmed ||
              deploying
            }
            onClick={deploy}
          >
            <Rocket size={18} />

            {deploying
              ? "Starting deployment…"
              : "Deploy App Update"}
          </button>

          {result && (
            <div
              className={styles.success}
              role="status"
            >
              <CheckCircle2 size={20} />

              <div>
                <strong>
                  App deployment started
                </strong>

                <span>
                  Vercel is building the approved
                  Campaign Seat release.
                </span>
              </div>
            </div>
          )}

          {error && (
            <div
              className={styles.error}
              role="alert"
            >
              {error}
            </div>
          )}
        </section>
      </div>
    </PlatformAdminShell>
  );
}
