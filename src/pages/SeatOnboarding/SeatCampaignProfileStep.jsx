import {
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Building2,
  CalendarDays,
  Globe2,
  Landmark,
  MapPin,
  Phone,
  Save,
} from "lucide-react";

import {
  saveMySeatCampaignProfile,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


const OFFICE_LEVELS = [
  ["", "Select office level"],
  ["federal", "Federal"],
  ["state", "State"],
  ["county", "County"],
  ["municipal", "Municipal"],
  ["school_board", "School Board"],
  ["special_district", "Special District"],
  ["other", "Other"],
  ["not_applicable", "Not applicable"],
];


const JURISDICTION_TYPES = [
  ["", "Select jurisdiction type"],
  ["federal", "Federal"],
  ["state", "State"],
  ["county", "County"],
  ["city", "City"],
  ["town", "Town"],
  ["village", "Village"],
  ["district", "District"],
  ["school_district", "School District"],
  ["special_district", "Special District"],
  ["other", "Other"],
];


const PARTIES = [
  ["", "Select political party"],
  ["republican", "Republican"],
  ["democratic", "Democratic"],
  ["independent", "Independent"],
  ["libertarian", "Libertarian"],
  ["green", "Green"],
  ["nonpartisan", "Nonpartisan"],
  ["other", "Other"],
];


function browserTimezone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "America/New_York"
    );
  } catch {
    return "America/New_York";
  }
}


export default function SeatCampaignProfileStep({
  onboarding,
}) {
  const defaultTimezone =
    useMemo(
      browserTimezone,
      [],
    );

  const [
    form,
    setForm,
  ] = useState({
    campaign_type:
      "candidate_campaign",

    campaign_name:
      onboarding?.account_name ||
      "",

    candidate_name:
      onboarding?.full_name ||
      "",

    legal_committee_name:
      "",

    office_sought:
      "",

    office_level:
      "",

    district_label:
      "",

    jurisdiction_name:
      "",

    jurisdiction_type:
      "",

    political_party:
      "",

    next_election_date:
      "",

    primary_election_date:
      "",

    general_election_date:
      "",

    timezone:
      defaultTimezone,

    campaign_email:
      onboarding?.email ||
      "",

    campaign_phone:
      "",

    website_url:
      "",

    address_line1:
      "",

    address_line2:
      "",

    address_city:
      "",

    state_region:
      "",

    county_name:
      "",

    municipality_name:
      "",

    postal_code:
      "",

    country_code:
      "US",

    disclaimer_text:
      "",
  });

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


  const update =
    (field) =>
      (event) => {
        setForm(
          (current) => ({
            ...current,
            [field]:
              event.target.value,
          }),
        );
      };


  const submit =
    async (event) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      setError("");
      setSaving(true);

      try {
        await saveMySeatCampaignProfile(
          form,
        );

        window.location.reload();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Campaign Profile could not be saved.",
        );
      } finally {
        setSaving(false);
      }
    };


  return (
    <form
      className={styles.profileCard}
      onSubmit={submit}
    >
      <div className={styles.profileHeading}>
        <div>
          <span className={styles.eyebrow}>
            Campaign profile
          </span>

          <h2>
            Tell us about the campaign.
          </h2>

          <p>
            These details will become the foundation of the Campaign Seat workspace when onboarding is activated.
          </p>
        </div>

        <Landmark size={26} />
      </div>


      <section className={styles.profileSection}>
        <div className={styles.profileSectionTitle}>
          <Building2 size={19} />

          <div>
            <strong>
              Campaign identity
            </strong>

            <span>
              Official and public campaign information.
            </span>
          </div>
        </div>

        <div className={styles.profileGrid}>
          <label className={styles.profileWide}>
            Campaign / workspace name

            <input
              value={form.campaign_name}
              onChange={update(
                "campaign_name",
              )}
              required
            />
          </label>

          <label>
            Campaign type

            <select
              value={form.campaign_type}
              onChange={update(
                "campaign_type",
              )}
            >
              <option value="candidate_campaign">
                Candidate campaign
              </option>

              <option value="ballot_measure">
                Ballot measure
              </option>

              <option value="pac">
                PAC
              </option>

              <option value="party_organization">
                Party organization
              </option>

              <option value="elected_official">
                Elected official
              </option>

              <option value="advocacy_organization">
                Advocacy organization
              </option>

              <option value="other">
                Other
              </option>
            </select>
          </label>

          <label>
            Candidate name

            <input
              value={form.candidate_name}
              onChange={update(
                "candidate_name",
              )}
              required={
                form.campaign_type ===
                "candidate_campaign"
              }
            />
          </label>

          <label className={styles.profileWide}>
            Legal committee name

            <input
              value={
                form.legal_committee_name
              }
              onChange={update(
                "legal_committee_name",
              )}
              placeholder="Optional"
            />
          </label>
        </div>
      </section>


      <section className={styles.profileSection}>
        <div className={styles.profileSectionTitle}>
          <MapPin size={19} />

          <div>
            <strong>
              Office & jurisdiction
            </strong>

            <span>
              Where this campaign is running.
            </span>
          </div>
        </div>

        <div className={styles.profileGrid}>
          <label>
            Office sought

            <input
              value={form.office_sought}
              onChange={update(
                "office_sought",
              )}
              placeholder="County Commissioner"
              required={
                form.campaign_type ===
                "candidate_campaign"
              }
            />
          </label>

          <label>
            Office level

            <select
              value={form.office_level}
              onChange={update(
                "office_level",
              )}
              required={
                form.campaign_type ===
                "candidate_campaign"
              }
            >
              {OFFICE_LEVELS.map(
                ([value, label]) => (
                  <option
                    value={value}
                    key={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            District / seat

            <input
              value={form.district_label}
              onChange={update(
                "district_label",
              )}
              placeholder="District 6"
            />
          </label>

          <label>
            Jurisdiction type

            <select
              value={
                form.jurisdiction_type
              }
              onChange={update(
                "jurisdiction_type",
              )}
            >
              {JURISDICTION_TYPES.map(
                ([value, label]) => (
                  <option
                    value={value}
                    key={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className={styles.profileWide}>
            Jurisdiction name

            <input
              value={
                form.jurisdiction_name
              }
              onChange={update(
                "jurisdiction_name",
              )}
              placeholder="Palm Beach County"
              required={
                form.campaign_type ===
                "candidate_campaign"
              }
            />
          </label>

          <label>
            State / region

            <input
              value={form.state_region}
              onChange={update(
                "state_region",
              )}
              placeholder="Florida"
            />
          </label>

          <label>
            County

            <input
              value={form.county_name}
              onChange={update(
                "county_name",
              )}
            />
          </label>

          <label>
            Municipality

            <input
              value={
                form.municipality_name
              }
              onChange={update(
                "municipality_name",
              )}
            />
          </label>

          <label>
            Political party

            <select
              value={
                form.political_party
              }
              onChange={update(
                "political_party",
              )}
              required={
                form.campaign_type ===
                "candidate_campaign"
              }
            >
              {PARTIES.map(
                ([value, label]) => (
                  <option
                    value={value}
                    key={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </section>


      <section className={styles.profileSection}>
        <div className={styles.profileSectionTitle}>
          <CalendarDays size={19} />

          <div>
            <strong>
              Election calendar
            </strong>

            <span>
              Dates that drive Campaign HQ countdowns and scheduling.
            </span>
          </div>
        </div>

        <div className={styles.profileGrid}>
          <label>
            Next election date

            <input
              type="date"
              value={
                form.next_election_date
              }
              onChange={update(
                "next_election_date",
              )}
              required={
                form.campaign_type ===
                "candidate_campaign"
              }
            />
          </label>

          <label>
            Primary election

            <input
              type="date"
              value={
                form.primary_election_date
              }
              onChange={update(
                "primary_election_date",
              )}
            />
          </label>

          <label>
            General election

            <input
              type="date"
              value={
                form.general_election_date
              }
              onChange={update(
                "general_election_date",
              )}
            />
          </label>

          <label>
            Timezone

            <input
              value={form.timezone}
              onChange={update(
                "timezone",
              )}
              required
            />
          </label>
        </div>
      </section>


      <section className={styles.profileSection}>
        <div className={styles.profileSectionTitle}>
          <Globe2 size={19} />

          <div>
            <strong>
              Campaign contact
            </strong>

            <span>
              Operational contact information for the workspace.
            </span>
          </div>
        </div>

        <div className={styles.profileGrid}>
          <label>
            Campaign email

            <input
              type="email"
              value={
                form.campaign_email
              }
              onChange={update(
                "campaign_email",
              )}
              required
            />
          </label>

          <label>
            Campaign phone

            <input
              value={
                form.campaign_phone
              }
              onChange={update(
                "campaign_phone",
              )}
            />
          </label>

          <label className={styles.profileWide}>
            Website

            <input
              type="url"
              value={form.website_url}
              onChange={update(
                "website_url",
              )}
              placeholder="https://"
            />
          </label>

          <label className={styles.profileWide}>
            Address line 1

            <input
              value={form.address_line1}
              onChange={update(
                "address_line1",
              )}
            />
          </label>

          <label className={styles.profileWide}>
            Address line 2

            <input
              value={form.address_line2}
              onChange={update(
                "address_line2",
              )}
            />
          </label>

          <label>
            City

            <input
              value={form.address_city}
              onChange={update(
                "address_city",
              )}
            />
          </label>

          <label>
            Postal code

            <input
              value={form.postal_code}
              onChange={update(
                "postal_code",
              )}
            />
          </label>

          <label>
            Country code

            <input
              maxLength={2}
              value={form.country_code}
              onChange={update(
                "country_code",
              )}
            />
          </label>
        </div>
      </section>


      <section className={styles.profileSection}>
        <div className={styles.profileSectionTitle}>
          <Phone size={19} />

          <div>
            <strong>
              Compliance
            </strong>

            <span>
              Optional campaign disclaimer for future materials and communications.
            </span>
          </div>
        </div>

        <label>
          Disclaimer

          <textarea
            value={
              form.disclaimer_text
            }
            onChange={update(
              "disclaimer_text",
            )}
            placeholder="Paid for by..."
            rows={3}
          />
        </label>
      </section>


      {error && (
        <div
          className={styles.error}
          role="alert"
        >
          {error}
        </div>
      )}


      <div className={styles.profileActions}>
        <div>
          <strong>
            Next: Security
          </strong>

          <span>
            No workspace will be activated yet.
          </span>
        </div>

        <button
          className={styles.primary}
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <>
              <Save size={18} />
              Saving…
            </>
          ) : (
            <>
              Save & Continue
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
