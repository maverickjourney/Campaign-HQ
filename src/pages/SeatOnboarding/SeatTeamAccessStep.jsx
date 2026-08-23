import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Crown,
  LoaderCircle,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import {
  loadMySeatTeamSetup,
  saveMySeatTeamSetup,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


function emptyMember() {
  return {
    full_name: "",
    email: "",
    role_key:
      "campaign_manager",
    display_title: "",
  };
}


export default function SeatTeamAccessStep() {
  const [
    setup,
    setSetup,
  ] =
    useState(null);

  const [
    members,
    setMembers,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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
            await loadMySeatTeamSetup();

          if (
            !active ||
            !result?.found
          ) {
            return;
          }

          setSetup(result);

          setMembers(
            result.planned_members ||
              [],
          );
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Team setup could not be loaded.",
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


  const remaining =
    useMemo(
      () =>
        Math.max(
          0,
          Number(
            setup
              ?.maximum_additional_members ||
            0,
          ) -
            members.length,
        ),
      [
        setup,
        members.length,
      ],
    );


  const addMember =
    () => {
      if (remaining <= 0) {
        return;
      }

      setMembers(
        (current) => [
          ...current,
          emptyMember(),
        ],
      );
    };


  const updateMember =
    (
      index,
      field,
      value,
    ) => {
      setMembers(
        (current) =>
          current.map(
            (
              member,
              memberIndex,
            ) =>
              memberIndex ===
              index
                ? {
                    ...member,
                    [field]:
                      value,
                  }
                : member,
          ),
      );
    };


  const removeMember =
    (index) => {
      setMembers(
        (current) =>
          current.filter(
            (
              _member,
              memberIndex,
            ) =>
              memberIndex !==
              index,
          ),
      );
    };


  const submit =
    async () => {
      if (saving) {
        return;
      }

      setSaving(true);
      setError("");

      try {
        await saveMySeatTeamSetup(
          members,
        );

        window.location.reload();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Team setup could not be saved.",
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <section
        className={
          styles.teamCard
        }
      >
        <LoaderCircle
          size={28}
        />

        Loading campaign team…
      </section>
    );
  }


  return (
    <section
      className={
        styles.teamCard
      }
    >
      <header
        className={
          styles.teamHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Team & access
          </span>

          <h2>
            Plan who should have Campaign Seat access.
          </h2>

          <p>
            Define the initial campaign team now. Invitations will be created only when the Campaign workspace is activated.
          </p>
        </div>

        <Users size={30} />
      </header>


      <div
        className={
          styles.teamNotice
        }
      >
        <ShieldCheck
          size={20}
        />

        <div>
          <strong>
            No invitations are being sent yet.
          </strong>

          <span>
            Campaign Seat will create the actual memberships and private invitations during Activation.
          </span>
        </div>
      </div>


      <article
        className={
          styles.primaryTeamMember
        }
      >
        <div
          className={
            styles.teamMemberIcon
          }
        >
          <Crown size={20} />
        </div>

        <div>
          <span>
            Primary account
          </span>

          <strong>
            {
              setup
                ?.primary_member
                ?.full_name
            }
          </strong>

          <small>
            {
              setup
                ?.primary_member
                ?.email
            }
          </small>
        </div>

        <div
          className={
            styles.ownerRole
          }
        >
          Candidate · Campaign Owner
        </div>
      </article>


      <div
        className={
          styles.teamCapacity
        }
      >
        <div>
          <strong>
            {
              setup
                ?.included_user_seats ||
              1
            }{" "}
            users included
          </strong>

          <span>
            Your primary Candidate account uses 1 seat.
          </span>
        </div>

        <strong>
          {remaining} additional seats remaining
        </strong>
      </div>


      <div
        className={
          styles.plannedTeamList
        }
      >
        {members.map(
          (
            member,
            index,
          ) => (
            <article
              className={
                styles.plannedTeamMember
              }
              key={index}
            >
              <div
                className={
                  styles.teamMemberHeading
                }
              >
                <div>
                  <span>
                    Team member{" "}
                    {index + 1}
                  </span>

                  <strong>
                    {member.full_name ||
                      "New team member"}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    removeMember(
                      index,
                    )
                  }
                  aria-label="Remove team member"
                >
                  <Trash2
                    size={17}
                  />
                </button>
              </div>


              <div
                className={
                  styles.profileGrid
                }
              >
                <label>
                  Full name

                  <input
                    value={
                      member.full_name
                    }
                    onChange={(
                      event,
                    ) =>
                      updateMember(
                        index,
                        "full_name",
                        event.target
                          .value,
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Email

                  <div
                    className={
                      styles.teamEmailField
                    }
                  >
                    <Mail
                      size={16}
                    />

                    <input
                      type="email"
                      value={
                        member.email
                      }
                      onChange={(
                        event,
                      ) =>
                        updateMember(
                          index,
                          "email",
                          event.target
                            .value,
                        )
                      }
                      required
                    />
                  </div>
                </label>

                <label>
                  Campaign role

                  <select
                    value={
                      member.role_key
                    }
                    onChange={(
                      event,
                    ) =>
                      updateMember(
                        index,
                        "role_key",
                        event.target
                          .value,
                      )
                    }
                  >
                    {(
                      setup?.roles ||
                      []
                    ).map(
                      (role) => (
                        <option
                          key={
                            role.role_key
                          }
                          value={
                            role.role_key
                          }
                        >
                          {role.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Display title

                  <input
                    value={
                      member
                        .display_title ||
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      updateMember(
                        index,
                        "display_title",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Optional"
                  />
                </label>
              </div>


              {member.role_key && (
                <div
                  className={
                    styles.roleExplanation
                  }
                >
                  {(
                    setup?.roles ||
                    []
                  ).find(
                    (role) =>
                      role.role_key ===
                      member.role_key,
                  )?.description}
                </div>
              )}
            </article>
          ),
        )}
      </div>


      {remaining > 0 && (
        <button
          className={
            styles.addTeamMember
          }
          type="button"
          onClick={addMember}
        >
          <Plus size={18} />
          Add team member
        </button>
      )}


      {!members.length && (
        <div
          className={
            styles.teamEmpty
          }
        >
          You can launch with only the Candidate account and invite the rest of the team later.
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


      <div
        className={
          styles.profileActions
        }
      >
        <div>
          <strong>
            Next: Review
          </strong>

          <span>
            Saving this plan does not send invitations.
          </span>
        </div>

        <button
          className={styles.primary}
          type="button"
          onClick={submit}
          disabled={saving}
        >
          {saving ? (
            "Saving…"
          ) : (
            <>
              Save Team Plan
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
