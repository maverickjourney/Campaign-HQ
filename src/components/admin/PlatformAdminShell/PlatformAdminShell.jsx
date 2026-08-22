import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import {
  signOutPlatformAdmin,
} from "../../../services/platformAdminAuth";

import SeatBrand
  from "../../brand/SeatBrand/SeatBrand";

import styles
  from "./PlatformAdminShell.module.css";

export default function PlatformAdminShell({
  title,
  description,
  actions,
  children,
}) {
  const navigate = useNavigate();

  const signOut = async () => {
    await signOutPlatformAdmin();

    navigate(
      "/admin/login",
      {
        replace: true,
      },
    );
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <SeatBrand
            variant="mark"
            color="white"
            className={styles.brandMark}
          />

          <div>
            <strong>
              Seat Platform
            </strong>

            <span>
              Administration
            </span>
          </div>
        </div>

        <div className={styles.security}>
          <ShieldCheck size={17} />

          <div>
            <strong>
              Security verified
            </strong>

            <span>
              Platform role + MFA
            </span>
          </div>
        </div>

        <nav>
          <NavLink
            end
            to="/admin"
            className={({ isActive }) =>
              isActive
                ? styles.active
                : undefined
            }
          >
            <LayoutDashboard size={18} />
            Overview
          </NavLink>

          <NavLink
            end
            to="/admin/customers"
            className={({ isActive }) =>
              isActive
                ? styles.active
                : undefined
            }
          >
            <Building2 size={18} />
            Customers
          </NavLink>

          <NavLink
            to="/admin/customers/new"
            className={({ isActive }) =>
              isActive
                ? styles.active
                : undefined
            }
          >
            <UserPlus size={18} />
            New Client
          </NavLink>
        </nav>

        <button
          className={styles.signOut}
          type="button"
          onClick={signOut}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </aside>

      <main className={styles.content}>
        <header className={styles.header}>
          <div>
            <span>
              Seat Platform Admin
            </span>

            <h1>
              {title}
            </h1>

            {description && (
              <p>
                {description}
              </p>
            )}
          </div>

          {actions}
        </header>

        {children}
      </main>
    </div>
  );
}
