import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  Cloud,
  CreditCard,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";

import {
  completeMySeatOnboardingReview,
  loadMySeatOnboardingReview,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


function money(
  cents,
  currency = "USD",
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(
    Number(cents || 0) /
      100,
  );
}


function dateLabel(
  value,
) {
  if (!value) {
    return "Not provided";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    ).format(
      new Date(
        `${value}T12:00:00`,
      ),
    );
  } catch {
    return value;
  }
}


function textLabel(
  value,
) {
  if (!value) {
    return "Not provided";
  }

  return String(value)
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}


export default function SeatReviewStep() {
  const [
    review,
    setReview,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    confirmed,
    setConfirmed,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const result =
            await loadMySeatOnboardingReview();

          if (active) {
            setReview(
              result,
            );
          }
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Your onboarding review could not be loaded.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    void load();

    return () => {
      active = false;
    };
  }, []);


  const profile =
    review?.profile ||
    {};

  const billing =
    review?.billing ||
    {};

  const commercial =
    review?.commercial ||
    {};

  const team =
    review?.team ||
    {};

  const connections =
    review
      ?.integration_connections ||
    [];

  const readiness =
    review
      ?.activation_readiness ||
    {};


  const plannedMembers =
    team.planned_members ||
    [];


  const billingAddress =
    billing.billing_address ||
    {};


  const billingAddressText =
    useMemo(
      () =>
        [
          billingAddress.line1,
          billingAddress.line2,
          [
            billingAddress.city,
            billingAddress.state_region,
            billingAddress.postal_code,
          ]
            .filter(Boolean)
            .join(", "),
          billingAddress.country_code,
        ]
          .filter(Boolean)
          .join(" · "),
      [
        billingAddress,
      ],
    );


  const submit =
    async () => {
      if (
        saving ||
        !confirmed
      ) {
        return;
      }

      setSaving(true);
      setError("");

      try {
        await completeMySeatOnboardingReview();

        window.location.reload();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Your onboarding review could not be confirmed.",
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <section
        className={
          styles.reviewCard
        }
      >
        <LoaderCircle
          size={28}
        />

        Loading your Campaign Seat review…
      </section>
    );
  }


  if (
    !review?.found
  ) {
    return (
      <section
        className={
          styles.reviewCard
        }
      >
        <TriangleAlert
          size={28}
        />

        <strong>
          Your onboarding review could not be found.
        </strong>
      </section>
    );
  }


  return (
    <section
      className={
        styles.reviewCard
      }
    >
      <header
        className={
          styles.reviewHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Review
          </span>

          <h2>
            Review your Campaign Seat setup.
          </h2>

          <p>
            Confirm the information collected during onboarding before Campaign Seat prepares the account for Activation.
          </p>
        </div>

        <BadgeCheck
          size={30}
        />
      </header>


      <div
        className={
          readiness.ready
            ? styles.reviewReadyBanner
            : styles.reviewPendingBanner
        }
      >
        {readiness.ready ? (
          <ShieldCheck
            size={21}
          />
        ) : (
          <TriangleAlert
            size={21}
          />
        )}

        <div>
          <strong>
            {readiness.ready
              ? "Ready for Activation"
              : "Review is ready. Activation still has outstanding requirements."}
          </strong>

          <span>
            {readiness.ready
              ? "All required launch connections are satisfied."
              : "You can confirm this review now. Campaign Seat will not activate the workspace until the remaining requirements are completed."}
          </span>
        </div>
      </div>


      <div
        className={
          styles.reviewGrid
        }
      >
        <article
          className={
            styles.reviewSection
          }
        >
          <div
            className={
              styles.reviewSectionHeading
            }
          >
            <Building2
              size={20}
            />

            <div>
              <strong>
                Campaign
              </strong>

              <span>
                Campaign identity and election information
              </span>
            </div>
          </div>

          <dl
            className={
              styles.reviewDetails
            }
          >
            <div>
              <dt>
                Campaign
              </dt>

              <dd>
                {profile.campaign_name}
              </dd>
            </div>

            <div>
              <dt>
                Candidate
              </dt>

              <dd>
                {profile.candidate_name}
              </dd>
            </div>

            <div>
              <dt>
                Office
              </dt>

              <dd>
                {textLabel(
                  profile.office_sought,
                )}
              </dd>
            </div>

            <div>
              <dt>
                District / seat
              </dt>

              <dd>
                {profile.district_label ||
                  "Not provided"}
              </dd>
            </div>

            <div>
              <dt>
                Jurisdiction
              </dt>

              <dd>
                {profile.jurisdiction_name ||
                  "Not provided"}
              </dd>
            </div>

            <div>
              <dt>
                Political party
              </dt>

              <dd>
                {textLabel(
                  profile.political_party,
                )}
              </dd>
            </div>
          </dl>


          <div
            className={
              styles.reviewMiniSection
            }
          >
            <CalendarDays
              size={17}
            />

            <div>
              <span>
                Next election
              </span>

              <strong>
                {dateLabel(
                  profile.next_election_date,
                )}
              </strong>
            </div>
          </div>


          <div
            className={
              styles.reviewMiniSection
            }
          >
            <MapPin size={17} />

            <div>
              <span>
                Campaign location
              </span>

              <strong>
                {[
                  profile.county_name,
                  profile.state_region,
                ]
                  .filter(Boolean)
                  .join(", ") ||
                  "Not provided"}
              </strong>
            </div>
          </div>
        </article>


        <article
          className={
            styles.reviewSection
          }
        >
          <div
            className={
              styles.reviewSectionHeading
            }
          >
            <CreditCard
              size={20}
            />

            <div>
              <strong>
                Billing
              </strong>

              <span>
                Approved commercial terms and billing contact
              </span>
            </div>
          </div>

          <div
            className={
              styles.reviewCommercial
            }
          >
            <div>
              <span>
                Monthly
              </span>

              <strong>
                {money(
                  commercial.monthly_amount_cents,
                  commercial.currency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Onboarding
              </span>

              <strong>
                {money(
                  commercial.onboarding_fee_cents,
                  commercial.currency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Users
              </span>

              <strong>
                {commercial.included_user_seats}
              </strong>
            </div>
          </div>

          <dl
            className={
              styles.reviewDetails
            }
          >
            <div>
              <dt>
                Billing contact
              </dt>

              <dd>
                {billing.billing_contact_name}
              </dd>
            </div>

            <div>
              <dt>
                Billing email
              </dt>

              <dd>
                {billing.billing_email}
              </dd>
            </div>

            <div
              className={
                styles.reviewDetailWide
              }
            >
              <dt>
                Billing address
              </dt>

              <dd>
                {billingAddressText ||
                  "Not provided"}
              </dd>
            </div>
          </dl>

          <div
            className={
              readiness.billing_ready
                ? styles.reviewStatusGood
                : styles.reviewStatusPending
            }
          >
            <span />

            {readiness.billing_ready
              ? "Billing provider ready"
              : "Billing provider connection pending"}
          </div>
        </article>


        <article
          className={
            styles.reviewSection
          }
        >
          <div
            className={
              styles.reviewSectionHeading
            }
          >
            <Cloud
              size={20}
            />

            <div>
              <strong>
                Integrations
              </strong>

              <span>
                Selected campaign communication and productivity tools
              </span>
            </div>
          </div>

          <div
            className={
              styles.reviewConnections
            }
          >
            {connections.map(
              (connection) => (
                <div
                  key={
                    connection.integration_key
                  }
                >
                  <div>
                    <strong>
                      {connection.display_name}
                    </strong>

                    <span>
                      Secure OAuth2 connection
                    </span>
                  </div>

                  <div
                    className={
                      connection.status ===
                      "connected"
                        ? styles.reviewStatusGood
                        : styles.reviewStatusPending
                    }
                  >
                    <span />

                    {connection.status ===
                    "connected"
                      ? "Connected"
                      : "Connection pending"}
                  </div>
                </div>
              ),
            )}
          </div>
        </article>


        <article
          className={
            styles.reviewSection
          }
        >
          <div
            className={
              styles.reviewSectionHeading
            }
          >
            <Users size={20} />

            <div>
              <strong>
                Team & access
              </strong>

              <span>
                Initial authorized Campaign Seat users
              </span>
            </div>
          </div>

          <div
            className={
              styles.reviewPrimaryMember
            }
          >
            <div>
              <strong>
                {
                  review.primary_contact
                    ?.full_name
                }
              </strong>

              <span>
                {
                  review.primary_contact
                    ?.email
                }
              </span>
            </div>

            <b>
              Candidate · Campaign Owner
            </b>
          </div>

          {plannedMembers.length ? (
            <div
              className={
                styles.reviewTeamList
              }
            >
              {plannedMembers.map(
                (member) => (
                  <div
                    key={
                      member.email
                    }
                  >
                    <div>
                      <strong>
                        {member.full_name}
                      </strong>

                      <span>
                        {member.email}
                      </span>
                    </div>

                    <b>
                      {textLabel(
                        member.role_key,
                      )}
                    </b>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div
              className={
                styles.reviewEmptyTeam
              }
            >
              Launching with the Candidate account only. Additional team members can be invited later.
            </div>
          )}
        </article>
      </div>


      <section
        className={
          styles.activationReadiness
        }
      >
        <div
          className={
            styles.reviewSectionHeading
          }
        >
          <ShieldCheck
            size={20}
          />

          <div>
            <strong>
              Activation readiness
            </strong>

            <span>
              Review what remains before Campaign Seat can create and activate the workspace.
            </span>
          </div>
        </div>

        <div
          className={
            styles.readinessList
          }
        >
          <div
            data-ready="true"
          >
            <Check size={16} />

            <span>
              Secure account verified
            </span>
          </div>

          <div
            data-ready="true"
          >
            <Check size={16} />

            <span>
              Campaign profile complete
            </span>
          </div>

          <div
            data-ready="true"
          >
            <Check size={16} />

            <span>
              Two-step verification complete
            </span>
          </div>

          <div
            data-ready={
              readiness.billing_ready
                ? "true"
                : "false"
            }
          >
            {readiness.billing_ready ? (
              <Check size={16} />
            ) : (
              <TriangleAlert
                size={16}
              />
            )}

            <span>
              {readiness.billing_ready
                ? "Billing provider ready"
                : "Billing provider still needs connection"}
            </span>
          </div>

          <div
            data-ready={
              readiness.integrations_ready
                ? "true"
                : "false"
            }
          >
            {readiness.integrations_ready ? (
              <Check size={16} />
            ) : (
              <TriangleAlert
                size={16}
              />
            )}

            <span>
              {readiness.integrations_ready
                ? "Required integrations connected"
                : `${readiness.pending_provider_connections || 0} provider connection(s) still pending`}
            </span>
          </div>

          <div
            data-ready="true"
          >
            <Check size={16} />

            <span>
              Team access plan saved
            </span>
          </div>
        </div>
      </section>


      <label
        className={
          styles.reviewConfirmation
        }
      >
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) =>
            setConfirmed(
              event.target.checked,
            )
          }
        />

        <div>
          <strong>
            I confirm these onboarding details are correct.
          </strong>

          <span>
            Use the Edit controls in the onboarding progress section above if anything needs to change before continuing.
          </span>
        </div>
      </label>


      {error && (
        <div
          className={
            styles.error
          }
          role="alert"
        >
          {error}
        </div>
      )}


      <div
        className={
          styles.profileActions
        }
      >
        <div>
          <strong>
            Next: Activation
          </strong>

          <span>
            Confirming Review does not activate the workspace.
          </span>
        </div>

        <button
          className={
            styles.primary
          }
          type="button"
          disabled={
            !confirmed ||
            saving
          }
          onClick={submit}
        >
          {saving
            ? "Confirming…"
            : (
              <>
                Confirm Review
                <ArrowRight
                  size={18}
                />
              </>
            )}
        </button>
      </div>
    </section>
  );
}
