import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Download,
  MonitorSmartphone,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";

import {
  getCampaignExperience,
} from "../../utils/campaignSession";

import styles from "./CampaignMobileSetup.module.css";

function readDeviceState() {
  const supportsServiceWorker =
    "serviceWorker" in navigator;

  const supportsNotifications =
    "Notification" in window;

  const standalone =
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches ||
    window.navigator.standalone ===
      true;

  return {
    supportsServiceWorker,
    supportsNotifications,
    standalone,
    permission:
      supportsNotifications
        ? Notification.permission
        : "unsupported",
  };
}

function getPlatform() {
  const userAgent =
    navigator.userAgent ||
    "";

  if (
    /iPad|iPhone|iPod/i.test(
      userAgent,
    )
  ) {
    return "ios";
  }

  if (
    /Android/i.test(
      userAgent,
    )
  ) {
    return "android";
  }

  return "desktop";
}

export function CampaignMobileSetup({
  userId,
  roleLabel,
}) {
  const experience =
    getCampaignExperience();

  const [
    device,
    setDevice,
  ] = useState(
    readDeviceState,
  );

  const [
    installPrompt,
    setInstallPrompt,
  ] = useState(
    () =>
      window
        .__campaignHQInstallPrompt ||
      null,
  );

  const [
    message,
    setMessage,
  ] = useState({
    tone: "",
    text: "",
  });

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const platform =
    getPlatform();

  const refresh =
    useCallback(() => {
      setDevice(
        readDeviceState(),
      );

      setInstallPrompt(
        window
          .__campaignHQInstallPrompt ||
        null,
      );
    }, []);

  useEffect(() => {
    const timer =
      window.setTimeout(
        refresh,
        0,
      );

    const handleInstallReady =
      () => {
        setInstallPrompt(
          window
            .__campaignHQInstallPrompt ||
          null,
        );
      };

    const handleInstalled =
      () => {
        setDevice(
          readDeviceState(),
        );

        setInstallPrompt(
          null,
        );

        setMessage({
          tone: "success",
          text:
            "Campaign HQ was installed on this device.",
        });
      };

    window.addEventListener(
      "campaignhq-install-ready",
      handleInstallReady,
    );

    window.addEventListener(
      "appinstalled",
      handleInstalled,
    );

    return () => {
      window.clearTimeout(
        timer,
      );

      window.removeEventListener(
        "campaignhq-install-ready",
        handleInstallReady,
      );

      window.removeEventListener(
        "appinstalled",
        handleInstalled,
      );
    };
  }, [refresh]);

  const installApp =
    async () => {
      const prompt =
        installPrompt ||
        window
          .__campaignHQInstallPrompt;

      if (!prompt) {
        setMessage({
          tone: "error",
          text:
            platform === "ios"
              ? "On iPhone or iPad, use Safari’s Share menu and choose Add to Home Screen."
              : "The browser has not offered installation yet. Refresh Campaign HQ and try again.",
        });

        return;
      }

      setIsWorking(true);
      setMessage({
        tone: "",
        text: "",
      });

      try {
        await prompt.prompt();

        const result =
          await prompt.userChoice;

        window
          .__campaignHQInstallPrompt =
          null;

        setInstallPrompt(
          null,
        );

        setMessage({
          tone:
            result.outcome ===
            "accepted"
              ? "success"
              : "error",
          text:
            result.outcome ===
            "accepted"
              ? "Campaign HQ installation was accepted."
              : "Campaign HQ was not installed.",
        });
      } finally {
        setIsWorking(false);
      }
    };

  const enableNotifications =
    async () => {
      if (
        !device
          .supportsNotifications
      ) {
        setMessage({
          tone: "error",
          text:
            "This browser does not support Campaign HQ notifications.",
        });

        return;
      }

      setIsWorking(true);
      setMessage({
        tone: "",
        text: "",
      });

      try {
        const permission =
          await Notification
            .requestPermission();

        setDevice(
          readDeviceState(),
        );

        if (
          permission ===
          "granted"
        ) {
          localStorage.setItem(
            `campaignHQ.mobileSetup.${userId}`,
            JSON.stringify({
              notificationsEnabled:
                true,
              updatedAt:
                new Date()
                  .toISOString(),
            }),
          );

          setMessage({
            tone: "success",
            text:
              "Notifications are enabled on this device. Send a test alert next.",
          });
        } else {
          setMessage({
            tone: "error",
            text:
              permission ===
              "denied"
                ? "Notifications are blocked in this device’s browser or system settings."
                : "Notification permission was not granted.",
          });
        }
      } finally {
        setIsWorking(false);
      }
    };

  const sendTestNotification =
    async () => {
      if (
        Notification.permission !==
        "granted"
      ) {
        setMessage({
          tone: "error",
          text:
            "Enable notifications before sending a test.",
        });

        return;
      }

      setIsWorking(true);
      setMessage({
        tone: "",
        text: "",
      });

      try {
        const registration =
          await navigator
            .serviceWorker
            .ready;

        await registration
          .showNotification(
            "Campaign HQ test alert",
            {
              body:
                "Your Campaign HQ phone notifications are working on this device.",
              icon:
                "/pwa/icon-192.png",
              badge:
                "/pwa/icon-192.png",
              tag:
                "campaign-hq-test",
              data: {
                url:
                  "/profile/settings",
              },
            },
          );

        setMessage({
          tone: "success",
          text:
            "A Campaign HQ test alert was sent to this device.",
        });
      } catch (error) {
        setMessage({
          tone: "error",
          text:
            error?.message ||
            "The test notification could not be sent.",
        });
      } finally {
        setIsWorking(false);
      }
    };

  const notificationReady =
    device.permission ===
    "granted";

  const notificationBlocked =
    device.permission ===
    "denied";

  return (
    <section
      className={
        styles.setupSection
      }
    >
      <header
        className={
          styles.sectionHeader
        }
      >
        <div
          className={
            styles.headerIcon
          }
        >
          <Smartphone
            size={23}
          />
        </div>

        <div
          className={
            styles.headerCopy
          }
        >
          <span>
            Mobile setup
          </span>

          <h2>
            Campaign HQ on this device
          </h2>

          <p>
            Install Campaign HQ,
            enable alerts and test the
            experience assigned to this
            account.
          </p>
        </div>

        <button
          className={
            styles.refreshButton
          }
          type="button"
          onClick={refresh}
          disabled={
            isWorking
          }
        >
          <RefreshCw
            size={17}
          />

          Refresh status
        </button>
      </header>

      {message.text && (
        <div
          className={`${styles.messageBanner} ${
            message.tone ===
            "success"
              ? styles.successBanner
              : styles.errorBanner
          }`}
          role={
            message.tone ===
            "success"
              ? "status"
              : "alert"
          }
        >
          {message.tone ===
          "success" ? (
            <CheckCircle2
              size={19}
            />
          ) : (
            <AlertTriangle
              size={19}
            />
          )}

          <span>
            {message.text}
          </span>
        </div>
      )}

      <div
        className={
          styles.statusGrid
        }
      >
        <article>
          <Download
            size={20}
          />

          <span>
            App installation
          </span>

          <strong>
            {device.standalone
              ? "Installed"
              : installPrompt
                ? "Ready to install"
                : platform === "ios"
                  ? "Add to Home Screen"
                  : "Browser setup"}
          </strong>

          <small>
            {device.standalone
              ? "READY"
              : "SETUP"}
          </small>
        </article>

        <article>
          <BellRing
            size={20}
          />

          <span>
            Notifications
          </span>

          <strong>
            {notificationReady
              ? "Enabled"
              : notificationBlocked
                ? "Blocked"
                : device.permission ===
                    "unsupported"
                  ? "Not supported"
                  : "Not enabled"}
          </strong>

          <small>
            {notificationReady
              ? "READY"
              : notificationBlocked
                ? "BLOCKED"
                : "SETUP"}
          </small>
        </article>

        <article>
          <MonitorSmartphone
            size={20}
          />

          <span>
            Remote delivery
          </span>

          <strong>
            Activation next
          </strong>

          <small>
            NEXT STAGE
          </small>
        </article>

        <article>
          <ShieldCheck
            size={20}
          />

          <span>
            Dashboard experience
          </span>

          <strong>
            {experience.name}
          </strong>

          <small>
            Based on {roleLabel}
          </small>
        </article>
      </div>

      <div
        className={
          styles.setupGrid
        }
      >
        <div
          className={
            styles.actionPanel
          }
        >
          <div>
            <span>
              Device actions
            </span>

            <h3>
              Finish setup
            </h3>

            <p>
              Complete the available
              steps and send a test
              notification.
            </p>
          </div>

          <div
            className={
              styles.actionButtons
            }
          >
            {!device.standalone && (
              <button
                className={
                  styles.primaryButton
                }
                type="button"
                onClick={
                  installApp
                }
                disabled={
                  isWorking
                }
              >
                <Download
                  size={17}
                />

                Install Campaign HQ
              </button>
            )}

            {!notificationReady && (
              <button
                className={
                  styles.primaryButton
                }
                type="button"
                onClick={
                  enableNotifications
                }
                disabled={
                  isWorking ||
                  !device
                    .supportsNotifications ||
                  notificationBlocked
                }
              >
                <BellRing
                  size={17}
                />

                Enable notifications
              </button>
            )}

            {notificationReady && (
              <button
                className={
                  styles.secondaryButton
                }
                type="button"
                onClick={
                  sendTestNotification
                }
                disabled={
                  isWorking ||
                  !device
                    .supportsServiceWorker
                }
              >
                <Send
                  size={17}
                />

                Send test alert
              </button>
            )}
          </div>
        </div>

        <div
          className={
            styles.instructionsPanel
          }
        >
          <span>
            Installation steps
          </span>

          <h3>
            {platform === "ios"
              ? "iPhone or iPad"
              : platform === "android"
                ? "Android phone"
                : "Computer or tablet"}
          </h3>

          {platform === "ios" ? (
            <ol>
              <li>
                Open Campaign HQ in
                Safari.
              </li>
              <li>
                Tap the Share button.
              </li>
              <li>
                Choose Add to Home
                Screen.
              </li>
              <li>
                Open the new Campaign
                HQ icon.
              </li>
              <li>
                Return here and enable
                notifications.
              </li>
            </ol>
          ) : (
            <ol>
              <li>
                Choose Install Campaign
                HQ.
              </li>
              <li>
                Open the installed app.
              </li>
              <li>
                Enable notifications.
              </li>
              <li>
                Send a test alert.
              </li>
            </ol>
          )}
        </div>
      </div>

      <div
        className={
          styles.safetyNotice
        }
      >
        <WifiOff
          size={20}
        />

        <div>
          <strong>
            Delivery safeguard
          </strong>

          <p>
            People can disable
            notifications, silence a
            phone or lose internet
            access. Remote delivery,
            acknowledgment tracking and
            SMS fallback are the next
            communication stages.
          </p>
        </div>
      </div>
    </section>
  );
}
