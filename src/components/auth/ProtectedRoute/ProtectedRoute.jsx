import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { restoreCampaignSession } from "../../../services/auth";
import { getCampaignExperience } from "../../../utils/campaignSession";
import styles from "./ProtectedRoute.module.css";

export default function ProtectedRoute({
  children,
  allowedExperiences = [],
}) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");
  const allowedKey = allowedExperiences.join("|");

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      const session = await restoreCampaignSession();

      if (!mounted) {
        return;
      }

      if (!session) {
        setStatus("signed-out");
        return;
      }

      const allowed = allowedKey
        ? allowedKey.split("|")
        : [];

      if (
        allowed.length &&
        !allowed.includes(getCampaignExperience().key)
      ) {
        setStatus("forbidden");
        return;
      }

      setStatus("authorized");
    };

    verify();

    return () => {
      mounted = false;
    };
  }, [allowedKey]);

  if (status === "checking") {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingMark}>
          <ShieldCheck size={28} strokeWidth={1.8} />
        </div>
        <strong>Opening Campaign HQ</strong>
        <span>Verifying your secure campaign access…</span>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (status === "forbidden") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
