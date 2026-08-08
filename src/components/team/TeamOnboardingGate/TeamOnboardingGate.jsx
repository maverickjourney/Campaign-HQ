import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import {
  useTeamOnboarding,
} from "../../../hooks/useTeamOnboarding";

import styles
  from "./TeamOnboardingGate.module.css";

export default function TeamOnboardingGate({
  workspaceId,
  activeMembers = [],
  pendingInvitations = [],
  canManageAccess = false,
  pageIsLoading = false,
}) {
  const {
    workspaceState,
    teamStep,
    communicationsStep,

    isLoading,
    isCompleting,
    error,

    completeTeam,
  } =
    useTeamOnboarding({
      workspaceId,
    });

  const controlledWritesEnabled =
    import.meta.env.DEV &&
    new URLSearchParams(
      window.location.search,
    ).get(
      "team-writes",
    ) ===
      "enabled";

  const activeOwners =
    activeMembers.filter(
      (member) =>
        member.roleKey ===
        "campaign_owner",
    );

  const hasMembers =
    activeMembers.length >=
      1;

  const hasOneOwner =
    activeOwners.length ===
      1;

  const rosterReady =
    hasMembers &&
    hasOneOwner;

  const teamIsCurrent =
    workspaceState
      ?.onboarding_current_step ===
      "team" &&
    teamStep
      ?.status ===
      "in_progress";

  const communicationsPending =
    communicationsStep
      ?.status ===
      "pending";

  const teamComplete =
    teamStep
      ?.status ===
      "complete";

  const communicationsStarted =
    workspaceState
      ?.onboarding_current_step ===
      "communications" &&
    communicationsStep
      ?.status ===
      "in_progress";

  const canComplete =
    controlledWritesEnabled &&
    canManageAccess &&
    rosterReady &&
    teamIsCurrent &&
    communicationsPending &&
    !pageIsLoading &&
    !isLoading &&
    !isCompleting;

  const openCommunications =
    () => {
      window.location.assign(
        "/workspace/settings?tab=integrations&onboarding=communications",
      );
    };

  const handleComplete =
    async () => {
      try {
        await completeTeam();

        openCommunications();
      } catch {
        // Protected hook surfaces
        // the user-facing error.
      }
    };

  return (
    <section
      className={
        styles.card
      }
    >
      <header
        className={
          styles.header
        }
      >
        <div
          className={
            styles.icon
          }
        >
          <UsersRound
            size={22}
          />
        </div>

        <div>
          <span>
            Team onboarding
          </span>

          <h2>
            Confirm Team &amp; Access
          </h2>

          <p>
            Review the campaign roster
            and access controls before
            moving to Email &amp;
            Contacts.
          </p>
        </div>
      </header>

      <div
        className={
          styles.grid
        }
      >
        <article
          className={
            hasMembers
              ? styles.ready
              : styles.attention
          }
        >
          {hasMembers ? (
            <CheckCircle2
              size={20}
            />
          ) : (
            <TriangleAlert
              size={20}
            />
          )}

          <div>
            <strong>
              Active campaign seats
            </strong>

            <small>
              {activeMembers.length}
              {" active "}
              {activeMembers.length === 1
                ? "member"
                : "members"}
              {" reviewed."}
            </small>
          </div>
        </article>

        <article
          className={
            hasOneOwner
              ? styles.ready
              : styles.attention
          }
        >
          {hasOneOwner ? (
            <UserRoundCheck
              size={20}
            />
          ) : (
            <TriangleAlert
              size={20}
            />
          )}

          <div>
            <strong>
              Campaign ownership
            </strong>

            <small>
              {hasOneOwner
                ? "Exactly one active Campaign Owner."
                : "Campaign Seat requires exactly one active Campaign Owner."}
            </small>
          </div>
        </article>

        <article
          className={
            canManageAccess
              ? styles.ready
              : styles.attention
          }
        >
          <ShieldCheck
            size={20}
          />

          <div>
            <strong>
              Protected access controls
            </strong>

            <small>
              {canManageAccess
                ? "Your session can manage protected campaign access."
                : "Your current access cannot confirm this onboarding phase."}
            </small>
          </div>
        </article>

        <article
          className={
            styles.informational
          }
        >
          <Clock3
            size={20}
          />

          <div>
            <strong>
              Pending invitations
            </strong>

            <small>
              {pendingInvitations.length}
              {" pending. Invitations "}
              do not need to be accepted
              before continuing.
            </small>
          </div>
        </article>
      </div>

      {error && (
        <div
          className={
            styles.error
          }
          role="alert"
        >
          <TriangleAlert
            size={18}
          />

          <span>
            {error}
          </span>
        </div>
      )}

      {!controlledWritesEnabled &&
        teamIsCurrent && (
          <div
            className={
              styles.controlled
            }
          >
            Controlled Team completion
            is locked on the normal
            development URL while this
            transition is being tested.
          </div>
        )}

      <footer
        className={
          styles.footer
        }
      >
        <div>
          <strong>
            {teamComplete ||
            communicationsStarted
              ? "Team & Access complete"
              : rosterReady &&
                  canManageAccess
                ? "Team & Access ready"
                : "Team & Access needs attention"}
          </strong>

          <span>
            {teamComplete ||
            communicationsStarted
              ? "Continue with Email & Contacts."
              : rosterReady &&
                  canManageAccess
                ? "Your roster and protected access controls are ready to confirm."
                : "Review the roster and campaign access requirements above."}
          </span>
        </div>

        {teamComplete ||
        communicationsStarted ? (
          <button
            type="button"
            className={
              styles.primary
            }
            onClick={
              openCommunications
            }
          >
            Open Email &amp; Contacts

            <ArrowRight
              size={17}
            />
          </button>
        ) : (
          <button
            type="button"
            className={
              styles.primary
            }
            onClick={
              handleComplete
            }
            disabled={
              !canComplete
            }
          >
            {isCompleting ? (
              <LoaderCircle
                className={
                  styles.spinner
                }
                size={17}
              />
            ) : (
              <ShieldCheck
                size={17}
              />
            )}

            {isCompleting
              ? "Confirming…"
              : "Confirm Team & Access"}

            {!isCompleting && (
              <ArrowRight
                size={17}
              />
            )}
          </button>
        )}
      </footer>
    </section>
  );
}
