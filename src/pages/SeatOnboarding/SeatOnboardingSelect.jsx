import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Check,
  ChevronDown,
} from "lucide-react";

import styles
  from "./SeatOnboarding.module.css";


export default function SeatOnboardingSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  required = false,
}) {
  const rootRef =
    useRef(null);

  const [
    open,
    setOpen,
  ] =
    useState(false);


  const selected =
    useMemo(
      () =>
        (options || [])
          .find(
            (option) =>
              option.value ===
              value,
          ) || null,
      [
        options,
        value,
      ],
    );


  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const close =
      (event) => {
        if (
          rootRef.current &&
          !rootRef.current.contains(
            event.target,
          )
        ) {
          setOpen(false);
        }
      };

    const keydown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setOpen(false);
        }
      };

    document.addEventListener(
      "mousedown",
      close,
    );

    document.addEventListener(
      "keydown",
      keydown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        close,
      );

      document.removeEventListener(
        "keydown",
        keydown,
      );
    };
  }, [
    open,
  ]);


  return (
    <div
      className={
        styles.formField
      }
      ref={rootRef}
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
          styles.onboardingSelect
        }
      >
        <button
          className={
            styles.onboardingSelectTrigger
          }
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() =>
            setOpen(
              (current) =>
                !current,
            )
          }
        >
          <div>
            <strong
              data-placeholder={
                selected
                  ? "false"
                  : "true"
              }
            >
              {selected?.label ||
                placeholder}
            </strong>

            {selected
              ?.description && (
              <span>
                {
                  selected
                    .description
                }
              </span>
            )}
          </div>

          <ChevronDown
            size={19}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            className={
              styles.onboardingSelectMenu
            }
            role="listbox"
          >
            {(options || [])
              .map(
                (option) => {
                  const isSelected =
                    option.value ===
                    value;

                  return (
                    <button
                      className={
                        styles.onboardingSelectOption
                      }
                      data-selected={
                        isSelected
                          ? "true"
                          : "false"
                      }
                      type="button"
                      role="option"
                      aria-selected={
                        isSelected
                      }
                      key={
                        option.value ||
                        "__blank"
                      }
                      onClick={() => {
                        onChange(
                          option.value,
                        );

                        setOpen(false);
                      }}
                    >
                      <div>
                        <strong>
                          {
                            option.label
                          }
                        </strong>

                        {option
                          .description && (
                          <span>
                            {
                              option
                                .description
                            }
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check
                          size={17}
                        />
                      )}
                    </button>
                  );
                },
              )}
          </div>
        )}
      </div>
    </div>
  );
}
