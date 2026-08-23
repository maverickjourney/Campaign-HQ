import {
  useMemo,
  useRef,
} from "react";

import {
  CalendarDays,
} from "lucide-react";

import styles
  from "./SeatOnboarding.module.css";


function formatDate(
  value,
) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
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


export default function SeatDateField({
  label,
  value,
  onChange,
  required = false,
  helper = "",
}) {
  const inputRef =
    useRef(null);

  const formatted =
    useMemo(
      () =>
        formatDate(
          value,
        ),
      [
        value,
      ],
    );


  const openPicker =
    () => {
      const input =
        inputRef.current;

      if (!input) {
        return;
      }

      input.focus();

      if (
        typeof input.showPicker ===
        "function"
      ) {
        try {
          input.showPicker();
        } catch {
          // Browser will still use
          // the native date control.
        }
      }
    };


  return (
    <div
      className={
        styles.formField
      }
    >
      <span
        className={
          styles.fieldLabel
        }
      >
        {label}

        {required && (
          <span
            className={
              styles.requiredMark
            }
          >
            *
          </span>
        )}
      </span>

      <div
        className={
          styles.onboardingDate
        }
      >
        <div
          className={
            styles.onboardingDateDisplay
          }
          onClick={
            openPicker
          }
        >
          <CalendarDays
            size={19}
          />

          <span
            data-empty={
              formatted
                ? "false"
                : "true"
            }
          >
            {formatted ||
              "Choose a date"}
          </span>
        </div>

        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          required={required}
          aria-label={label}
        />
      </div>

      {helper && (
        <small
          className={
            styles.fieldHelper
          }
        >
          {helper}
        </small>
      )}
    </div>
  );
}
