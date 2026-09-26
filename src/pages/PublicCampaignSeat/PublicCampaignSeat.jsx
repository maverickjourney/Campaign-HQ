import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  FileText,
  Inbox,
  LockKeyhole,
  MapPinned,
  Menu,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";

import styles from "./PublicCampaignSeat.module.css";

const APP_URL = "https://app.campaignseat.com/";
const PARENT_URL = "https://ccinnovationgroupllc.com/";
const SUPPORT_EMAIL = "support@ccinnovationgroupllc.com";

const SMS_DISCLOSURE =
  "I agree to receive recurring SMS text messages from Campaign Seat, operated by CC INNOVATION GROUP LLC, for account notifications, onboarding communications, task and reminder alerts, approval alerts, field-operation alerts, weekly account summaries, and customer support. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent to SMS is optional and is not a condition of creating, accessing, or using a Campaign Seat account.";

const FEATURES = [
  [Inbox, "Inbox & communications", "Keep internal conversations, external handoffs and campaign communication activity organized in one place."],
  [CheckSquare, "Tasks & reminders", "Assign work, track deadlines and surface overdue or waiting-on activity without losing momentum."],
  [ClipboardCheck, "Approvals", "Route items to the right reviewer, track status and keep authorization workflows visible."],
  [CalendarDays, "Calendar & events", "Coordinate campaign schedules, deadlines and events from the same operating environment."],
  [MapPinned, "Field operations", "Prepare assignments, routes, volunteer handoffs, completion status and leadership review."],
  [Users, "Team access", "Give each campaign role the workspace, permissions and information appropriate to their responsibilities."],
  [FileText, "Documents & records", "Keep campaign files and operational records connected to the work they support."],
  [Sparkles, "Campaign intelligence", "Use AI-assisted workflows to organize information, surface priorities and reduce administrative friction."],
];

function Brand() {
  return (
    <a className={styles.brand} href="/" aria-label="Campaign Seat home">
      <span className={styles.brandMark} aria-hidden="true">C</span>
      <span className={styles.brandWords}><small>CAMPAIGN</small><strong>SEAT</strong></span>
    </a>
  );
}

function Header({ page }) {
  const [open, setOpen] = useState(false);


  return (
    <header className={styles.header}>
      <Brand />
      <nav className={styles.desktopNav} aria-label="Main navigation">
        <a href={page === "home" ? "#product" : "/#product"}>Product</a>
        <a href={page === "home" ? "#platform" : "/#platform"}>Platform</a>
        <a href={page === "home" ? "#notifications" : "/#notifications"}>Notifications</a>
        <a href={page === "home" ? "#company" : "/#company"}>Company</a>
      </nav>
      <div className={styles.headerActions}>
        <a className={styles.signIn} href={APP_URL}>Sign in</a>
        <a className={styles.headerCta} href={`mailto:${SUPPORT_EMAIL}?subject=Campaign%20Seat%20access`}>Request access</a>
      </div>
      <button className={styles.menuButton} type="button" aria-label="Open navigation" onClick={() => setOpen((value) => !value)}>
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>
      {open ? (
        <nav className={styles.mobileNav}>
          <a href="/">Home</a>
          <a href="/#product">Product</a>
          <a href="/#notifications">Notifications</a>
          <a href="/sms-consent/">SMS Consent</a>
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          <a href={APP_URL}>Sign in</a>
        </nav>
      ) : null}
    </header>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerIntro}>
          <Brand />
          <p>The operating system for modern campaign teams.</p>
          <small>Campaign Seat is a software product operated by CC INNOVATION GROUP LLC.</small>
        </div>
        <div><strong>Product</strong><a href="/#product">Platform overview</a><a href="/#notifications">Account notifications</a><a href={APP_URL}>Sign in</a></div>
        <div><strong>Compliance</strong><a href="/sms-consent/">SMS Consent</a><a href="/privacy/">Privacy Policy</a><a href="/terms/">Terms & Conditions</a></div>
        <div><strong>Company</strong><a href={PARENT_URL} target="_blank" rel="noreferrer">CC Innovation Group</a><a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a></div>
      </div>
      <div className={styles.footerBottom}>
        <span>© 2026 CC INNOVATION GROUP LLC. All rights reserved.</span>
        <span>Campaign Seat platform messaging is separate from campaign voter/contact outreach.</span>
      </div>
    </footer>
  );
}

function ProductPreview() {
  return (
    <div className={styles.preview} aria-label="Campaign Seat product interface illustration">
      <div className={styles.previewBar}>
        <div><i /><i /><i /></div>
        <strong>CAMPAIGN WORKSPACE</strong>
        <span><ShieldCheck size={13} /> Protected</span>
      </div>
      <div className={styles.previewBody}>
        <aside>
          <div className={styles.previewCampaign}><small>DISTRICT 6</small><strong>Campaign HQ</strong></div>
          {['HQ','Inbox','Calendar','Tasks','Approvals','Team'].map((item, index) => <span className={index === 0 ? styles.previewActive : ''} key={item}>{item}</span>)}
        </aside>
        <main>
          <div className={styles.previewTitle}>
            <div><small>COMMAND CENTER</small><strong>Good morning.</strong></div>
            <span><i /> Systems ready</span>
          </div>
          <div className={styles.metrics}>
            <article><small>Open tasks</small><strong>18</strong><span>4 due today</span></article>
            <article><small>Approvals</small><strong>3</strong><span>awaiting review</span></article>
            <article><small>Field routes</small><strong>12</strong><span>8 active</span></article>
          </div>
          <div className={styles.previewPanels}>
            <article>
              <header><strong>Priority work</strong><span>View all</span></header>
              {['Finalize field launch','Review volunteer brief','Confirm weekend events'].map((item) => (
                <div className={styles.previewTask} key={item}><CheckCircle2 size={15}/><div><strong>{item}</strong><small>Campaign workflow</small></div></div>
              ))}
            </article>
            <article>
              <header><strong>Activity</strong><span>Live</span></header>
              {['Task assignment updated','Field handoff acknowledged','Approval submitted'].map((item) => (
                <div className={styles.previewActivity} key={item}><i/><div><strong>{item}</strong><small>moments ago</small></div></div>
              ))}
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <main className={styles.home} id="top">
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>CAMPAIGN OPERATIONS, ORGANIZED</span>
          <h1>One seat for the work that moves a campaign.</h1>
          <p>Campaign Seat brings tasks, approvals, calendars, field operations, communications, documents and team workflows into one role-aware command center.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href={`mailto:${SUPPORT_EMAIL}?subject=Campaign%20Seat%20demo`}>Request a demo <ArrowRight size={17}/></a>
            <a className={styles.secondaryButton} href={APP_URL}>Sign in to Campaign Seat</a>
          </div>
          <div className={styles.trustRow}>
            <span><ShieldCheck size={16}/> Role-aware access</span>
            <span><Workflow size={16}/> Connected workflows</span>
            <span><BellRing size={16}/> Optional account alerts</span>
          </div>
        </div>
        <ProductPreview />
      </section>

      <section className={styles.statement}>
        <span>BUILT FOR THE REAL WORKFLOW</span>
        <h2>Less chasing.<br/>More command.</h2>
        <p>Campaign teams move quickly across people, deadlines, approvals, field work and communications. Campaign Seat gives that activity a shared operating layer so important work is visible before it becomes urgent.</p>
      </section>

      <section className={styles.features} id="product">
        <div className={styles.sectionHead}>
          <span>THE PLATFORM</span>
          <h2>The campaign command center, built around the team.</h2>
          <p>Different roles see different work, but the campaign stays connected through one operating system.</p>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map(([Icon, title, text]) => (
            <article key={title}><span><Icon size={21}/></span><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className={styles.workflow} id="platform">
        <div><span className={styles.eyebrow}>HOW IT WORKS</span><h2>The right information reaches the right person.</h2><p>Campaign Seat is designed around ownership, accountability and handoff — not another stream of disconnected alerts.</p></div>
        <div className={styles.steps}>
          <article><strong>01</strong><h3>Organize</h3><p>Bring campaign activity into a structured workspace with clear owners, routes and due dates.</p></article>
          <article><strong>02</strong><h3>Route</h3><p>Assign work and approvals to the correct campaign role while keeping leadership informed.</p></article>
          <article><strong>03</strong><h3>Act</h3><p>Surface the next action through the dashboard, browser alerts and optional account SMS.</p></article>
        </div>
      </section>

      <section className={styles.notifications} id="notifications">
        <div className={styles.notificationCopy}>
          <span className={styles.blueEyebrow}><MessageSquare size={16}/> OPTIONAL ACCOUNT NOTIFICATIONS</span>
          <h2>Stay informed without living in the dashboard.</h2>
          <p>Campaign Seat users can optionally receive text notifications for important account activity such as task reminders, approval requests, onboarding updates, workspace alerts and customer support.</p>
          <div className={styles.notificationPoints}>
            <span><CheckCircle2 size={17}/>SMS enrollment is optional.</span>
            <span><CheckCircle2 size={17}/>Users choose their own notification categories.</span>
            <span><CheckCircle2 size={17}/>Reply STOP to opt out or HELP for help.</span>
            <span><CheckCircle2 size={17}/>Platform SMS is separate from voter/contact outreach.</span>
          </div>
          <a className={styles.inlineLink} href="/sms-consent/">View the public SMS consent process <ArrowRight size={16}/></a>
        </div>
        <div className={styles.notificationCard}>
          <header><span><BellRing size={21}/></span><div><small>ACCOUNT NOTIFICATIONS</small><strong>Choose what needs your attention.</strong></div></header>
          {['Campaign updates','Tasks & reminders','Approval requests','Field-operation alerts','Weekly campaign summary'].map((label, index) => (
            <div className={styles.settingRow} key={label}><span>{label}</span><i className={index === 2 ? styles.switchOff : styles.switchOn}><b/></i></div>
          ))}
          <div className={styles.smsNote}><MessageSquare size={17}/><div><strong>SMS is optional</strong><small>Enroll or disable from Profile & Settings.</small></div></div>
        </div>
      </section>

      <section className={styles.company} id="company">
        <div><span className={styles.eyebrow}>OPERATED BY</span><h2>CC INNOVATION GROUP LLC</h2></div>
        <div><p>Campaign Seat is a software product and customer-facing brand operated by CC INNOVATION GROUP LLC. The company develops digital systems that turn complex workflows into organized, usable operating environments.</p><a href={PARENT_URL} target="_blank" rel="noreferrer">Visit CC Innovation Group <ArrowRight size={16}/></a></div>
      </section>

      <section className={styles.finalCta}>
        <div><span>CAMPAIGN SEAT</span><h2>Command the work. Organize the team. Move the campaign.</h2></div>
        <a className={styles.primaryButton} href={`mailto:${SUPPORT_EMAIL}?subject=Campaign%20Seat%20demo`}>Request a demo <ArrowRight size={17}/></a>
      </section>
    </main>
  );
}

function LegalShell({ eyebrow, title, intro, children }) {
  return (
    <main className={styles.legalPage}>
      <section className={styles.legalHero}><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p><small>Effective August 28, 2026</small></section>
      <div className={styles.legalLayout}>
        <aside><strong>Campaign Seat</strong><span>Operated by CC INNOVATION GROUP LLC</span><a href="/">Product website</a><a href="/sms-consent/">SMS Consent</a><a href="/privacy/">Privacy Policy</a><a href="/terms/">Terms & Conditions</a></aside>
        <article className={styles.legalContent}>{children}</article>
      </div>
    </main>
  );
}

function SmsConsentPage() {
  const [consentChecked, setConsentChecked] = useState(false);
  return (
    <LegalShell eyebrow="PUBLIC SMS DISCLOSURE" title="Campaign Seat SMS Consent" intro="Campaign Seat account SMS is optional. This public page explains exactly how Campaign Seat users enroll in account text notifications and what they consent to receive.">
      <section><h2>Optional account notifications</h2><p>Campaign Seat is operated by CC INNOVATION GROUP LLC. Campaign Seat users may voluntarily enroll in SMS notifications for their own software account. SMS consent is not required to create, access or use a Campaign Seat account.</p><div className={styles.callout}><ShieldCheck size={21}/><div><strong>Platform SMS is separate from campaign voter/contact outreach.</strong><p>This consent applies only to messages about the user's own Campaign Seat account, onboarding, operational alerts and customer support.</p></div></div></section>
      <section><h2>How enrollment works</h2><ol className={styles.legalSteps}><li><strong>Sign in to Campaign Seat.</strong><span>The user opens Profile & Settings → Notifications.</span></li><li><strong>Enter a personal mobile number.</strong><span>Campaign Seat does not preselect SMS or use a campaign-contact number for platform consent.</span></li><li><strong>Affirmatively check the SMS consent box.</strong><span>The checkbox is unchecked by default and the full disclosure is displayed before enrollment.</span></li><li><strong>Choose notification categories.</strong><span>Users can separately enable or disable campaign updates, tasks, approvals, field alerts and weekly summaries.</span></li></ol></section>
      <section>
        <h2>
          Exact enrollment
          disclosure
        </h2>

        <p>
          The following is the
          disclosure presented to a
          Campaign Seat user when
          enrolling in platform SMS:
        </p>

        <div
          className={
            styles.consentDemo
          }
        >
          <div
            className={
              styles.consentDemoTop
            }
          >
            <MessageSquare
              size={20}
            />

            <div>
              <strong>
                Text notifications
              </strong>

              <span>
                Optional Campaign
                Seat account
                notifications
              </span>
            </div>
          </div>

          <label>
            <span>
              Mobile phone number
            </span>

            <input
              type="tel"
              placeholder="(555) 555-5555"
              aria-label="Example mobile phone number"
              disabled
            />
          </label>

          <label
            className={
              styles.consentCheckbox
            }
          >
            <input
              type="checkbox"
              checked={
                consentChecked
              }
              onChange={(
                event,
              ) =>
                setConsentChecked(
                  event
                    .currentTarget
                    .checked,
                )
              }
            />

            <span>
              {SMS_DISCLOSURE}
            </span>
          </label>

          <div
            className={
              styles.consentActions
            }
          >
            <button
              type="button"
              className={
                styles.demoButton
              }
              disabled={
                !consentChecked
              }
              onClick={() => {
                window.location.href =
                  APP_URL;
              }}
            >
              Enable text notifications
            </button>

            <a
              className={
                styles.continueWithoutSms
              }
              href={
                APP_URL
              }
            >
              Continue without SMS
            </a>
          </div>

          <div
            className={
              styles.consentLegalLinks
            }
          >
            <a href="/privacy/">
              Privacy Policy
            </a>

            <span>
              •
            </span>

            <a href="/terms/">
              Terms & Conditions
            </a>
          </div>

          <small>
            This public page
            demonstrates the exact
            consent language and
            unchecked-checkbox
            behavior. SMS is
            optional. A Campaign
            Seat user may continue
            without enrolling in
            text notifications.
            Actual account SMS
            enrollment is completed
            from the signed-in
            Campaign Seat Profile &
            Settings area.
          </small>
        </div>
      </section>
      <section><h2>Message types</h2><p>Depending on the categories a user chooses, Campaign Seat may send account notifications such as task and reminder alerts, approval alerts, high-value workspace updates, field-operation alerts, onboarding communications, weekly account summaries and customer-support messages.</p></section>
      <section><h2>Frequency, rates and opt-out</h2><p>Message frequency varies based on account activity and the notification categories selected by the user. Message and data rates may apply. Reply <strong>STOP</strong> to opt out of SMS or <strong>HELP</strong> for help.</p><p>Users may also disable SMS from Campaign Seat Profile & Settings. Disabling SMS does not prevent the user from continuing to use Campaign Seat.</p></section>
      <section><h2>Contact</h2><p>For questions about Campaign Seat platform messaging, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section>
    </LegalShell>
  );
}

function PrivacyPage() {
  return (
    <LegalShell eyebrow="PRIVACY" title="Campaign Seat Privacy Policy" intro="This Privacy Policy explains how Campaign Seat, operated by CC INNOVATION GROUP LLC, handles information used to provide the Campaign Seat software platform.">
      <section><h2>1. Who operates Campaign Seat</h2><p>Campaign Seat is a software product operated by CC INNOVATION GROUP LLC ("CC Innovation Group," "Campaign Seat," "we," "us," or "our").</p></section>
      <section><h2>2. Information we may collect</h2><p>We may collect account and profile information, campaign workspace information, content users choose to store in the platform, technical and security information, support communications and optional notification preferences.</p></section>
      <section><h2>3. How information is used</h2><p>We use information to provide, secure, maintain and improve Campaign Seat; authenticate users; route role-appropriate workflows; provide support; communicate about account activity; and comply with legal obligations.</p></section>
      <section>
        <h2>
          4. SMS privacy
        </h2>

        <p>
          If a Campaign Seat user
          voluntarily enrolls in
          platform SMS, we process
          the mobile number, consent
          record, notification
          preferences and messaging
          activity needed to provide
          those account
          notifications.
        </p>

        <div
          className={
            styles.complianceCallout
          }
        >
          <LockKeyhole
            size={22}
          />

          <div>
            <strong>
              SMS opt-in data is not
              sold or shared for
              marketing.
            </strong>

            <p>
              Mobile numbers, text
              messaging originator
              opt-in data and SMS
              consent records are
              not sold, rented or
              shared with third
              parties for their
              marketing or
              promotional purposes.
              Service providers may
              process this data only
              as necessary to
              operate and deliver
              Campaign Seat
              messages on our
              behalf and may not use
              the consent for their
              own marketing or
              promotional purposes.
            </p>
          </div>
        </div>
      </section>
      <section><h2>5. Service providers</h2><p>We may use infrastructure, authentication, hosting, communications, security, analytics and support providers to operate Campaign Seat. Those providers receive only the information reasonably necessary to perform their services for us.</p></section>
      <section><h2>6. Security and retention</h2><p>Campaign Seat uses administrative, technical and organizational safeguards designed to protect account and workspace information. We retain information for as long as reasonably necessary to provide the service, maintain security and operational records, meet contractual commitments and comply with legal requirements.</p></section>
      <section><h2>7. Choices and contact</h2><p>Users can manage supported account information and notification preferences within Campaign Seat. SMS users can reply STOP to opt out and HELP for help. Privacy questions may be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section>
    </LegalShell>
  );
}

function TermsPage() {
  return (
    <LegalShell eyebrow="TERMS" title="Campaign Seat Terms & Conditions" intro="These Terms govern access to and use of Campaign Seat, a software platform operated by CC INNOVATION GROUP LLC.">
      <section><h2>1. Campaign Seat service</h2><p>Campaign Seat provides software tools for campaign operations, including workflow, communications, scheduling, approvals, field operations, team access, documents and related functionality. Features may change as the platform develops.</p></section>
      <section><h2>2. Accounts and authorized access</h2><p>Users must provide accurate account information, protect their credentials and use Campaign Seat only within the permissions granted to their account and campaign workspace.</p></section>
      <section><h2>3. Acceptable use</h2><p>Users may not use Campaign Seat to violate law, interfere with platform security, gain unauthorized access, distribute malicious content or use the service in a manner that materially harms Campaign Seat, CC Innovation Group or other users.</p></section>
      <section><h2>4. Campaign compliance</h2><p>Campaign Seat provides operational software and does not replace legal, election, campaign-finance or regulatory advice. Campaign organizations remain responsible for complying with laws, regulations and consent obligations applicable to their activities.</p></section>
      <section>
        <h2>
          5. Campaign Seat SMS
          Program Terms
        </h2>

        <p>
          Campaign Seat users may
          optionally enroll in
          recurring account SMS for
          software notifications
          such as tasks and
          reminders, approvals,
          onboarding, workspace
          alerts, field-operation
          alerts, weekly account
          summaries and customer
          support. Message frequency
          varies based on account
          activity and the
          notification categories
          selected by the user.
          Message and data rates may
          apply.
        </p>

        <p>
          Reply
          <strong> STOP </strong>
          to opt out of SMS at any
          time or
          <strong> HELP </strong>
          for help. SMS consent is
          optional and is not a
          condition of creating,
          accessing or using a
          Campaign Seat account.
        </p>

        <p>
          For customer care or help
          with the Campaign Seat SMS
          program, contact
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {` ${SUPPORT_EMAIL}`}
          </a>.
          Wireless carriers are not
          liable for delayed or
          undelivered messages.
        </p>

        <p>
          Campaign Seat platform
          SMS is separate from
          political campaign
          voter/contact outreach.
          Opting into Campaign Seat
          platform notifications
          does not constitute consent
          to receive campaign
          advocacy, voter,
          fundraising or other
          political outreach.
        </p>
      </section>
      <section><h2>6. Third-party services and availability</h2><p>Campaign Seat may integrate with or rely on third-party services. Availability and operation of those services may be subject to separate terms, policies and technical limitations. We may modify, improve, suspend or discontinue features as reasonably necessary to operate, secure or develop Campaign Seat.</p></section>
      <section><h2>7. Contact</h2><p>Questions about these Terms or Campaign Seat may be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section>
    </LegalShell>
  );
}

export default function PublicCampaignSeat({ page = "home" }) {
  const content = page === "sms-consent" ? <SmsConsentPage/> : page === "privacy" ? <PrivacyPage/> : page === "terms" ? <TermsPage/> : <HomePage/>;
  return <div className={styles.site}><Header page={page}/>{content}<Footer/></div>;
}
