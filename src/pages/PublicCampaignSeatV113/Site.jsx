import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, ClipboardCheck,
  Clock3, FileText, History, Layers3, LockKeyhole, Mail, Menu, MessageCircle,
  MessageSquareText, ShieldCheck, Sparkles, Users, Workflow, X, Megaphone,
  CalendarDays, BarChart3, Radio, Target, ListTodo, Network, Handshake,
  PlayCircle, MousePointerClick, BadgeCheck, ExternalLink, Activity,
} from 'lucide-react';
import styles from './Site.module.css';

const EMAIL = 'support@ccinnovationgroupllc.com';
const COMPANY_URL = 'https://ccinnovationgroupllc.com/';
// V114: public copy explains outcomes and verified modules; it never exposes the private portal.
const ROUTES = [
  { title: 'Platform', href: '/platform/' },
  { title: 'Communications', href: '/communications/' },
  { title: "Who it's for", href: '/who-its-for/' },
  { title: 'Trust & security', href: '/trust/' },
  { title: 'About', href: '/about/' },
];
const SEO = {
  home: { title: 'Campaign Seat | Keep the context. Move forward.', description: 'A private campaign workspace for relationships, communication context and follow-through. Bring the history behind your work together and request a personal walkthrough.', path: '/' },
  platform: { title: 'Campaign Operations & Tools | Campaign Seat', description: 'Explore Campaign Seat capabilities for contacts, internal communications, tasks, approvals, calendars, team management and coordinated campaign work.', path: '/platform/' },
  communications: { title: 'Communications & Marketing Coordination | Campaign Seat', description: 'Campaign Seat helps campaign teams document conversations, coordinate marketing work, track decisions and preserve the context behind relationships.', path: '/communications/' },
  audiences: { title: "Who It's For | Campaign Seat", description: 'Explore how campaign leaders, communications staff, operations teams and transitioning organizations can use Campaign Seat to keep essential context together.', path: '/who-its-for/' },
  trust: { title: 'Trust & Security | Campaign Seat', description: 'Learn about the private workspaces, individual accounts, role-aware access and leadership multifactor authentication supported by Campaign Seat.', path: '/trust/' },
  about: { title: 'Why Campaign Seat | A Better Way to Coordinate Campaign Teams', description: 'Designed around the communication, marketing coordination and team handoffs that make political campaigns complex. Discover the mission behind Campaign Seat.', path: '/about/' },
  contact: { title: 'Request a Walkthrough | Campaign Seat', description: 'See whether Campaign Seat fits your campaign or organization. Request a personal product walkthrough and learn about the invitation-only private beta.', path: '/walkthrough/' },
};

const cap = (icon, title, description) => ({ icon, title, description });
const PILLARS = [
  cap(Users, 'Relationships with context', 'Keep contact information connected to the background and history behind each relationship.'),
  cap(MessageSquareText, 'Communication continuity', 'Document important conversation details so your team can find the context later.'),
  cap(ClipboardCheck, 'Follow-through that stays visible', 'Bring commitments and next steps into the work your team is already managing.'),
  cap(FileText, 'Knowledge the team can keep', 'Organize relevant records and decisions so handoffs do not mean starting over.'),
];

function Brand({ light = false }) {
  return <a className={`${styles.brand} ${light ? styles.brandOnDark : ''}`} href="/" aria-label="Campaign Seat home">
    <span className={styles.brandIcon}>C<span /></span>
    <span className={styles.brandName}>CAMPAIGN <b>SEAT</b></span>
  </a>;
}

function CTALink({ children = 'Request a walkthrough', secondary = false, className = '' }) {
  return <a href="/walkthrough/" className={`${styles.cta} ${secondary ? styles.ctaOutline : ''} ${className}`}>
    {children}<ArrowUpRight size={18} aria-hidden="true" />
  </a>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const current = window.location.pathname;
  return <>
    <div className={styles.notice}><span className={styles.noticeDot} /> PRIVATE BETA FOR CAMPAIGN & COMMUNICATIONS TEAMS <span className={styles.noticeDivider}>/</span> <a href="/walkthrough/">Explore the possibilities <ArrowUpRight size={12} aria-hidden="true" /></a></div>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Brand />
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {ROUTES.map(r => <a className={current === r.href ? styles.activeNav : ''} href={r.href} key={r.href}>{r.title}</a>)}
        </nav>
        <div className={styles.headerActions}><CTALink>Request a walkthrough</CTALink></div>
        <button type="button" className={styles.menuToggle} onClick={() => setOpen(x => !x)} aria-expanded={open} aria-controls="campaign-seat-mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
      {open && <nav id="campaign-seat-mobile-menu" className={styles.mobileMenu} aria-label="Mobile navigation">
        <a onClick={close} href="/">Home</a>
        {ROUTES.map(r => <a onClick={close} href={r.href} key={r.href}>{r.title}</a>)}
        <a className={styles.mobileContact} onClick={close} href="/walkthrough/">Request a walkthrough <ArrowUpRight size={16}/></a>
      </nav>}
    </header>
  </>;
}

function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.wrap}>
      <div className={styles.footerTop}>
        <div className={styles.footerMission}><Brand light /><p>Campaign communication, coordination and institutional knowledge. One home for the work that connects your team.</p><span>Campaign Seat is a software product operated by CC INNOVATION GROUP LLC.</span></div>
        <div className={styles.footerLinks}>
          <div><strong>Explore</strong><a href="/platform/">The platform & tools</a><a href="/communications/">Communications & marketing</a><a href="/who-its-for/">Who it's for</a><a href="/trust/">Trust & security</a><a href="/about/">Our mission</a></div>
          <div><strong>Information</strong><a href="/privacy/">Privacy policy</a><a href="/terms/">Terms & conditions</a><a href="/sms-consent/">SMS consent</a></div>
          <div><strong>Connect</strong><a href="/walkthrough/">Request a walkthrough</a><a href={`mailto:${EMAIL}`}>Contact support</a><a href="/about/">The Campaign Seat mission <ArrowUpRight size={12}/></a></div>
        </div>
      </div>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()} CC INNOVATION GROUP LLC. All rights reserved.</span><span>Campaign Seat · Invitation-only private beta</span></div>
    </div>
  </footer>;
}

function Eyebrow({ children, dark = false }) { return <div className={`${styles.eyebrow} ${dark ? styles.eyebrowLight : ''}`}><i />{children}</div>; }
function ArrowLink({ href, children }) { return <a className={styles.arrowLink} href={href}>{children}<ArrowRight size={18} aria-hidden="true" /></a>; }

// Deliberately conceptual, not a photograph or clone of the authenticated application.
function KnowledgeVisual({ compact = false }) {
  return <div className={`${styles.visual} ${compact ? styles.visualCompact : ''}`} aria-label="Conceptual illustration showing people, communication context and next actions organized together" role="img">
    <div className={styles.visualBack} />
    <div className={styles.visualCard}>
      <div className={styles.visualTop}><span className={styles.visualMonogram}>C<span /></span><span className={styles.visualWordmark}>CAMPAIGN SEAT</span><span className={styles.visualPrivate}><ShieldCheck size={13}/> PRIVATE WORKSPACE</span></div>
      <div className={styles.visualContent}>
        <span className={styles.visualKicker}>THE BIGGER PICTURE</span>
        <h3>One relationship.<br/>The context that matters.</h3>
        <p>Make the next conversation smarter than the last.</p>
        <div className={styles.visualChain}>
          <div><span><Users size={21}/></span><div><small>PEOPLE</small><strong>Relationships</strong></div><CheckCircle2 size={16} className={styles.visualCheck}/></div>
          <div><span><MessageSquareText size={21}/></span><div><small>CONTEXT</small><strong>Communication history</strong></div><CheckCircle2 size={16} className={styles.visualCheck}/></div>
          <div><span><ClipboardCheck size={21}/></span><div><small>CONTINUITY</small><strong>Next steps</strong></div><CheckCircle2 size={16} className={styles.visualCheck}/></div>
        </div>
      </div>
      <div className={styles.visualBottom}><ShieldCheck size={15}/> A conceptual overview — detailed software is shown privately</div>
    </div>
    <div className={styles.visualFloat}><History size={20}/><div><small>THE DIFFERENCE</small><strong>Keep the context. Move forward.</strong></div></div>
  </div>;
}

function BottomCTA({ eyebrow = 'SEE THE BIGGER PICTURE', title = 'Bring the whole story together.', description = 'Tell us about your team. We’ll show you how Campaign Seat could support the work that matters to you.' }) {
  return <section className={styles.bottomCTA}><div className={`${styles.wrap} ${styles.bottomGrid}`}><div><Eyebrow dark>{eyebrow}</Eyebrow><h2>{title}</h2><p>{description}</p></div><div><CTALink secondary>Request a private walkthrough</CTALink><small>Private beta access is reviewed individually.</small></div></div></section>;
}

function FAQ({ items }) {
  return <div className={styles.faqList}>{items.map(([question, answer], i) => <details key={question} className={styles.faqItem} open={i === 0}><summary>{question}<ChevronDown size={18}/></summary><p>{answer}</p></details>)}</div>;
}

function Home() {
  return <>
    <section className={styles.hero}><div className={`${styles.wrap} ${styles.heroGrid}`}>
      <div className={styles.heroCopy}><Eyebrow dark>THE CAMPAIGN OPERATIONS & COMMUNICATIONS PLATFORM</Eyebrow>
        <h1>Keep your campaign connected.<em>Keep every important detail.</em></h1>
        <p>From communications and marketing coordination to contacts, staff assignments and follow-ups, Campaign Seat gives teams a shared place to organize the work and remember what happened — during the race and after it.</p>
        <div className={styles.heroButtons}><CTALink>Request a walkthrough</CTALink><a className={styles.textButton} href="/platform/">Explore what it does <ArrowRight size={18}/></a></div>
        <div className={styles.heroProof}><span><ShieldCheck size={15}/> Role-aware campaign workspace</span><span><MessageSquareText size={15}/> Shared communication context</span><span><ClipboardCheck size={15}/> Assigned next steps</span></div>
      </div>
      <KnowledgeVisual />
    </div></section>
    <div className={styles.underHero}><div className={styles.wrap}><b>Built for the work between the big moments.</b> Communications, relationships, operations and accountability — connected. <a href="/platform/">See what connects <ArrowRight size={17}/></a></div></div>
    <section className={styles.section} id="why"><div className={styles.wrap}>
      <div className={styles.sectionHeading}><div><Eyebrow>THE PROBLEM</Eyebrow><h2>Great campaigns communicate constantly.<br/><em>The context still gets lost.</em></h2></div><p>A press request lives in one inbox. A donor or community contact sits in a spreadsheet. A creative approval waits in a group chat. Someone promises to follow up — but no one is sure who owns it. Campaign Seat is built for that coordination gap.</p></div>
      <div className={styles.statementBand}><div><span>WHAT THE TEAM NEEDS</span><strong>Who owns the relationship?</strong></div><div><span>WHAT THE TEAM FORGETS</span><strong>What did we agree to?</strong></div><div><span>WHAT THE TEAM MUST DO</span><strong>Who is responsible next?</strong></div></div>
    </div></section>
    <section className={`${styles.section} ${styles.sectionSoft}`}><div className={styles.wrap}>
      <div className={styles.centerHeading}><Eyebrow>THE CAMPAIGN SEAT DIFFERENCE</Eyebrow><h2>From scattered updates<br/><em>to shared understanding.</em></h2><p>It's not just a contact list or another place to post messages. It's a way to give campaign teams a common view of what was communicated, what needs approval, what was promised and what happens next.</p></div>
      <div className={styles.pillarGrid}>{PILLARS.map(({icon: Icon,title,description},i)=><article className={styles.pillar} key={title}><span className={styles.pillarNumber}>0{i+1}</span><div className={styles.pillarIcon}><Icon size={25}/></div><h3>{title}</h3><p>{description}</p></article>)}</div>
      <div className={styles.sectionAfter}><ArrowLink href="/platform/">See the capabilities and workspace tools</ArrowLink></div>
    </div></section>
    <section className={`${styles.section} ${styles.v114CommsSection}`} data-reveal><div className={`${styles.wrap} ${styles.v114CommsGrid}`}>
      <div><Eyebrow>FOR CAMPAIGN COMMUNICATIONS & MARKETING</Eyebrow><h2>Plan the message.<br/><em>Keep the team aligned.</em></h2><p>Campaign communications is more than what gets published. It's the briefs, interviews, approvals, conversations, deadlines, and people responsible for each step.</p><p>Campaign Seat helps teams organize those moving parts and preserve the decisions behind them — without claiming to replace your existing email, texting, advertising or social publishing tools.</p><ArrowLink href="/communications/">How communications teams use Campaign Seat</ArrowLink></div>
      <div className={styles.v114CommsStack}>
        <div><span><Megaphone size={20}/></span><div><strong>Messaging & content coordination</strong><small>Briefs, assignments, drafts and reviews</small></div></div>
        <div><span><Radio size={20}/></span><div><strong>Media & relationship follow-up</strong><small>Context around partners, press and conversations</small></div></div>
        <div><span><ClipboardCheck size={20}/></span><div><strong>Approvals and accountability</strong><small>Know who needs to review, respond or act</small></div></div>
        <div><span><History size={20}/></span><div><strong>Long-term campaign memory</strong><small>Keep the useful context when roles change</small></div></div>
      </div>
    </div></section>
    <section className={styles.section}><div className={`${styles.wrap} ${styles.storyGrid}`}>
      <div><Eyebrow>ONE REAL-WORLD SCENARIO</Eyebrow><h2>One conversation.<br/><em>A team that remembers.</em></h2><p>A communications director receives a media inquiry. The team records who made the request, routes the response for review, assigns the follow-up and retains the context for the next conversation.</p><p>It's a simple moment. But repeated across a campaign, that continuity changes how a team works.</p><span className={styles.exampleNote}>Illustrative scenario. No private campaign records shown.</span></div>
      <div className={styles.storySteps}><div><span>01</span><div><strong>The inquiry arrives</strong><p>A reporter, partner or stakeholder contacts a member of the campaign team.</p></div><MessageCircle size={23}/></div><div><span>02</span><div><strong>The context and decision are recorded</strong><p>The team documents relevant facts, review needs and the agreed response.</p></div><FileText size={23}/></div><div><span>03</span><div><strong>Someone owns the next step</strong><p>A response, approval or follow-up has a responsible team member.</p></div><ClipboardCheck size={23}/></div></div>
    </div></section>
    <section className={`${styles.section} ${styles.darkSplit}`}><div className={`${styles.wrap} ${styles.darkSplitGrid}`}>
      <div><Eyebrow dark>BUILT FOR EVERY CHAPTER</Eyebrow><h2>Win or lose,<br/><em>the relationships still matter.</em></h2><p>The team may change. The priorities may shift. Keeping the work organized lets you build on what you already know instead of starting from scratch.</p><ArrowLink href="/who-its-for/">See who Campaign Seat helps</ArrowLink></div>
      <div className={styles.chapterCard}><div><span>01</span><strong>While the campaign is moving</strong><p>Keep important relationships and follow-through in view.</p></div><div><span>02</span><strong>When teams and responsibilities change</strong><p>Make handoffs easier by preserving documented context.</p></div><div><span>03</span><strong>When the next chapter begins</strong><p>Return to the history that still has value.</p></div></div>
    </div></section>
    <section className={styles.section}><div className={`${styles.wrap} ${styles.trustTeaser}`}><div className={styles.trustSymbol}><ShieldCheck size={32}/></div><div><Eyebrow>RESPONSIBLE ACCESS</Eyebrow><h2>Shared knowledge. <em>Controlled access.</em></h2><p>Private campaign workspaces, individual accounts, role-aware permissions and leadership multi-factor authentication help teams share context responsibly.</p></div><ArrowLink href="/trust/">Explore our security approach</ArrowLink></div></section>
    <section className={`${styles.section} ${styles.sectionSoft}`}><div className={`${styles.wrap} ${styles.editorialGrid}`}>
      <div><Eyebrow>QUESTIONS WORTH ASKING</Eyebrow><h2>What should you know <em>before we talk?</em></h2><p className={styles.faqIntro}>Understand exactly what the beta helps organize, where existing services still fit, and what to expect from a private walkthrough.</p></div>
      <FAQ items={[
        ['Does Campaign Seat replace email, texting or the tools we already use?', 'Not necessarily. Teams can keep using their existing channels and document the important context in Campaign Seat. Supported integrations depend on your workspace and configured services.'],
        ['Will it automatically import every old message?', 'No. Campaign Seat does not promise universal automatic import of emails, calls, or texts. We can discuss your sources and the workflows currently supported in a private walkthrough.'],
        ['Can my whole team use the same account?', 'Team members use individual accounts. Access to information and actions is shaped by their workspace membership and assigned role.'],
        ['Can we see the real platform?', 'Yes. We show the actual software during a private, guided walkthrough. Detailed product screens and customer information are not displayed publicly.'],
        ['Is this for marketing and media teams, or just campaign managers?', 'Both. Campaign Seat supports internal coordination around communications, marketing plans, media relationships, reviews, approvals, tasks and handoffs. It is not advertised as a replacement for ad platforms or mass-texting vendors.'],
        ['What tools can our staff organize?', 'The workspace includes areas for contacts and communication context, inbox, calendars, tasks, commitments, waiting-on items, documents, approvals, team management and additional campaign operations. Availability depends on your beta workspace and role.'],
        ['Does it send campaign email blasts, ads, or political texts?', 'Campaign Seat is presented as a coordination and knowledge workspace, not a mass outreach, advertising, voter-file or election-compliance service. Any supported channel integration is shown and verified during your walkthrough.'],
        ['What happens after Election Day?', 'Campaign Seat can help authorized teams preserve useful history and organize follow-through as people and responsibilities change, subject to applicable records obligations.'],
        ['Who is Campaign Seat intended for?', 'Campaign managers, communications and marketing staff, operations teams, organizers, volunteers and approved collaborators can benefit from a shared workspace. Available screens and actions depend on assigned permissions.'],
        ['What can we start organizing in the private beta?', 'A walkthrough can show how contacts, documented communications, tasks, approvals, schedules and team coordination work in your approved workspace. Some additional campaign modules or integrations may still be in beta or limited release.'],
        ['Can separate teams and campaigns have private workspaces?', 'Campaign Seat supports separate campaign workspaces with role-aware access. Workspace eligibility and account setup are reviewed during onboarding.'],
        ['How do we get access, and what does it cost?', 'There is no open public registration. Request a walkthrough so we can review your needs, the beta scope and any applicable pricing or participation terms before inviting your team.'],
      ]}/>
    </div></section>
    <BottomCTA />
  </>;
}

const platformFeatures = [
  { icon: Users, index: '01 / RELATIONSHIPS', title: 'Know the person beyond the contact card.', text: 'Keep important contact details and relationship context together so your team has a stronger starting point for the next interaction.', benefit: 'People, context and continuity' },
  { icon: MessageSquareText, index: '02 / COMMUNICATIONS', title: 'The conversation should not end in someone’s inbox.', text: 'Document the important details from communications and team handoffs instead of relying on disconnected messages or individual memory.', benefit: 'History the team can return to' },
  { icon: ClipboardCheck, index: '03 / FOLLOW-THROUGH', title: 'Give the next step a clear place to live.', text: 'Connect tasks, commitments and follow-ups to the work they support so the team knows what needs attention.', benefit: 'Action, ownership and accountability' },
  { icon: FileText, index: '04 / KNOWLEDGE', title: 'Preserve the information behind the work.', text: 'Keep relevant records, documents and decisions organized for authorized team members as responsibilities evolve.', benefit: 'Better handoffs and less rebuilding' },
];

function SubHero({ eyebrow, title, accent, description, note }) { return <section className={styles.subHero}><div className={`${styles.wrap} ${styles.subHeroGrid}`}><div><Eyebrow dark>{eyebrow}</Eyebrow><h1>{title}<em>{accent}</em></h1><p>{description}</p></div><div className={styles.subHeroAside}><span><Sparkles size={21}/></span><strong>{note}</strong><small>Campaign Seat · Private platform</small></div></div></section>; }

const WORKSPACE_CAPABILITIES = [
  {icon:Users,name:'People & relationships',summary:'Make every important conversation easier to place in context.',items:['Contacts and relationship records','Communication notes and history','Team and volunteer context']},
  {icon:MessageSquareText,name:'Communications & marketing',summary:'Coordinate the work behind the message, not just the message itself.',items:['Internal inbox and communications activity','Media, social and content planning areas','Review requests and handoffs']},
  {icon:ClipboardCheck,name:'Work & accountability',summary:'Keep promises, owners and deadlines from slipping between teams.',items:['Tasks, reminders and assignments','Commitments and Waiting On','Approval and decision workflows']},
  {icon:CalendarDays,name:'Schedules & operations',summary:'Give your team a shared context for operational work.',items:['Calendar and event coordination','Documents and campaign materials','Field and inventory workspace areas']},
  {icon:BarChart3,name:'Leadership oversight',summary:'See what needs attention across the work your team documents.',items:['Campaign HQ command view','Reports and team activity views','Access and workspace settings']},
  {icon:ShieldCheck,name:'Private team access',summary:'Let people collaborate without sharing account credentials.',items:['Individual user accounts','Role-aware permissions','Leadership multi-factor authentication']},
];

function Platform() { return <>
  <SubHero eyebrow="THE PLATFORM" title="A place for the work." accent="A home for the history." description="Campaign Seat brings the relationships, communication context, records and follow-through behind campaign work into one private workspace." note="The value is in what stays connected." />
  <section className={styles.section} data-reveal><div className={styles.wrap}><div className={styles.sectionHeading}><div><Eyebrow>WHAT IT BRINGS TOGETHER</Eyebrow><h2>Four essentials.<br/><em>One more connected team.</em></h2></div><p>We focus on what your team needs to know and do — without publishing the application's private screens or internal processes.</p></div><div className={styles.featureList}>{platformFeatures.map(({icon:Icon,index,title,text,benefit})=><article key={index}><div className={styles.featureIndex}>{index}</div><div><h3>{title}</h3><p>{text}</p><small><CheckCircle2 size={15}/>{benefit}</small></div><div className={styles.featureIcon}><Icon size={31}/></div></article>)}</div></div></section>
  <section className={`${styles.section} ${styles.v114ToolsSection}`} data-reveal><div className={styles.wrap}>
    <div className={styles.sectionHeading}><div><Eyebrow>THE WORKSPACE TOOLS</Eyebrow><h2>Know what your team<br/><em>can organize in one place.</em></h2></div><p>Campaign Seat combines practical day-to-day workspace areas. Below are representative capabilities, not a public copy of the private portal or a guarantee that every beta feature or connection is available to every team.</p></div>
    <div className={styles.v114ToolsGrid}>
      {WORKSPACE_CAPABILITIES.map(({icon:Icon,name,summary,items})=><article key={name} className={styles.v114ToolCard}><div className={styles.v114ToolHeader}><span><Icon size={23}/></span><h3>{name}</h3></div><p>{summary}</p><ul>{items.map(item=><li key={item}><Check size={14}/>{item}</li>)}</ul></article>)}
    </div>
    <p className={styles.v114Availability}><ShieldCheck size={16}/> Available modules, permissions, integrations and rollout stages vary by workspace. We demonstrate the exact capabilities applicable to your team on a private call.</p>
  </div></section>
  <section className={`${styles.section} ${styles.sectionSoft}`}><div className={`${styles.wrap} ${styles.editorialGrid}`}><div><Eyebrow>YOUR EXISTING TOOLS</Eyebrow><h2>Work with the channels you have.<br/><em>Keep the context that matters.</em></h2></div><div><p>Campaign Seat isn't built on a claim that every email, call or text automatically appears in one place. Teams can document important communication history, use supported integrations where configured, and create clearer follow-through.</p><p>Feature availability and connected services vary by workspace. In a private walkthrough, we'll show you the real experience and discuss your team's specific needs.</p><ArrowLink href="/walkthrough/">Discuss your workflow</ArrowLink></div></div></section>
  <BottomCTA title="See how the pieces fit together." description="A guided walkthrough shows the software itself, with the details and capabilities relevant to your team." />
</>; }

const COMMUNICATIONS_USE_CASES = [
  {icon:Megaphone,title:'Coordinate campaigns and content',lead:'From message planning to approval.',detail:'Keep briefs, content ownership, calendar dates, required reviews and follow-up work visible to the team responsible for delivery.'},
  {icon:Radio,title:'Remember media and partner conversations',lead:'The important details should not live with one person.',detail:'Document the relationship, relevant requests and next actions so communications staff have context when conversations continue.'},
  {icon:Users,title:'Connect people across campaign teams',lead:'Campaign managers, consultants, staff and volunteers need the same facts.',detail:'Use individual accounts and role-aware access to keep authorized teammates informed about their responsibilities.'},
  {icon:ClipboardCheck,title:'Move decisions into action',lead:'What was approved? Who responds? What is due?',detail:'Track assignments, approvals, commitments and waiting-on items rather than losing decisions in message threads.'},
];

function Communications() { return <>
  <SubHero eyebrow="COMMUNICATIONS & MARKETING" title="The message matters." accent="So does the work behind it." description="Campaign teams send messages, organize events, brief candidates, work with media and coordinate marketing across channels. Campaign Seat helps keep the internal context, people and next steps from becoming scattered." note="Built for communications work that involves an entire team."/>
  <section className={`${styles.section} ${styles.v114CommsIntro}`} data-reveal><div className={`${styles.wrap} ${styles.editorialGrid}`}>
    <div><Eyebrow>CAMPAIGN REALITY</Eyebrow><h2>A public message starts<br/><em>with private coordination.</em></h2></div>
    <div><p>A candidate's statement may involve a communications director, designer, legal review, field lead and scheduler. A community meeting produces contacts and promises. A press call needs background, a response and a follow-up.</p><p>Those are connected pieces of campaign work, even when they're happening in different tools. Campaign Seat gives authorized teams a place to document the context and coordinate what comes next.</p><ArrowLink href="/walkthrough/">Show us your workflow</ArrowLink></div>
  </div></section>
  <section className={`${styles.section} ${styles.sectionSoft}`} data-reveal><div className={styles.wrap}><div className={styles.sectionHeading}><div><Eyebrow>HOW THE PLATFORM SUPPORTS YOUR TEAM</Eyebrow><h2>Fewer loose ends.<br/><em>Better coordinated work.</em></h2></div><p>These are practical use cases, not a promise of automated social publishing, mass email delivery or historical-message capture.</p></div>
    <div className={styles.v114UseCaseGrid}>{COMMUNICATIONS_USE_CASES.map(({icon:Icon,title,lead,detail},i)=><article key={title}><div className={styles.v114UseCaseIcon}><Icon size={24}/><span>0{i+1}</span></div><h3>{title}</h3><strong>{lead}</strong><p>{detail}</p></article>)}</div>
  </div></section>
  <section className={`${styles.section} ${styles.v114FlowSection}`} data-reveal><div className={styles.wrap}><div className={styles.sectionHeading}><div><Eyebrow>ONE CONNECTED EXAMPLE</Eyebrow><h2>From the first request<br/><em>to the last follow-up.</em></h2></div><p>Choose a scenario to see how people, context and accountability fit together. All scenarios are fictional and intentionally avoid private interface details.</p></div><CampaignScenario/></div></section>
  <section className={`${styles.section} ${styles.sectionSoft}`} data-reveal><div className={`${styles.wrap} ${styles.editorialGrid}`}><div><Eyebrow>WHAT CAMPAIGN SEAT IS — AND IS NOT</Eyebrow><h2>A team coordination layer.<br/><em>Not another marketing channel.</em></h2></div><div><p>Campaign Seat does not claim to replace advertising platforms, campaign mass-email vendors, SMS outreach providers, voter databases or election finance compliance software. Teams continue using the channels that make sense for their program.</p><p>Campaign Seat is designed to make the work around those channels more organized: relationships, notes, requests, review, decisions, assigned actions and documented history. Connected services and supported workflows are reviewed during a private walkthrough.</p><ArrowLink href="/platform/">Explore all capability areas</ArrowLink></div></div></section>
  <BottomCTA eyebrow="LET'S TALK ABOUT YOUR CAMPAIGN" title="A better-connected communications team starts here." description="Show us how your staff coordinates communications today. We'll demonstrate where Campaign Seat fits, what it supports, and what remains in your existing tools."/>
</>; }

const SCENARIOS = [
 {id:'press',label:'Media inquiry',icon:Radio,title:'From press request to approved response',description:'A reporter calls your communications lead. The team keeps the relationship context, coordinates a response and follows through.',steps:['Record the inquiry and relevant context','Assign the review or approval','Track the response and next conversation']},
 {id:'marketing',label:'Marketing campaign',icon:Megaphone,title:'From brief to coordinated execution',description:'A campaign message needs creative, timing, approval and people working in sync.',steps:['Keep the campaign brief and ownership clear','Coordinate deadlines and approval work','Record decisions and outstanding actions']},
 {id:'transition',label:'Team handoff',icon:Handshake,title:'From staff turnover to continuity',description:'A staff member steps away. The next person needs to know the contacts, commitments and work in progress.',steps:['Find the documented relationship history','Review outstanding commitments and tasks','Hand off to an authorized team member']},
];
function CampaignScenario(){
 const [selected,setSelected]=useState('press');
 const current=SCENARIOS.find(v=>v.id===selected)||SCENARIOS[0];
 const Icon=current.icon;
 return <div className={styles.v114Scenario}>
  <div className={styles.v114ScenarioTabs} role="tablist" aria-label="Illustrative campaign coordination scenarios">{SCENARIOS.map(v=><button type="button" key={v.id} role="tab" id={`scenario-${v.id}`} aria-controls="campaign-scenario-panel" aria-selected={v.id===selected} onClick={()=>setSelected(v.id)} className={v.id===selected?styles.v114ScenarioActive:''}>{<v.icon size={18}/>} {v.label}</button>)}</div>
  <div id="campaign-scenario-panel" role="tabpanel" aria-labelledby={`scenario-${current.id}`} className={styles.v114ScenarioPanel} key={current.id}><div className={styles.v114ScenarioCopy}><span className={styles.v114ScenarioCaption}><Icon size={19}/> ILLUSTRATIVE TEAM WORKFLOW</span><h3>{current.title}</h3><p>{current.description}</p><a href="/walkthrough/">See the real product in a private walkthrough <ArrowUpRight size={17}/></a></div><div className={styles.v114ScenarioSteps}>{current.steps.map((step,i)=><div key={step}><span>{String(i+1).padStart(2,'0')}</span><strong>{step}</strong><CheckCircle2 size={18}/></div>)}</div></div>
 </div>;
}

const audiences = [
  { title: 'Campaign leadership', tag: 'KEEP THE WHOLE PICTURE', description: 'Get a clearer view of priorities, relationships and the important decisions behind the work.', wins: ['Context across the team', 'A more organized handoff', 'Less dependence on individual memory'] },
  { title: 'Communications & marketing', tag: 'KEEP THE TEAM ALIGNED', description: 'Coordinate briefs, media relationships, approvals, campaign messages and next steps when work crosses people and channels.', wins: ['Documented contact context', 'Important follow-up visibility', 'Less disconnected knowledge'] },
  { title: 'Operations & staff', tag: 'KEEP WORK MOVING', description: 'Make responsibilities, tasks and team records easier to understand and coordinate.', wins: ['Clear next actions', 'Shared operational context', 'Consistent team collaboration'] },
  { title: 'Teams in transition', tag: 'KEEP WHAT YOU BUILT', description: 'Preserve relevant campaign knowledge as team structures and priorities evolve.', wins: ['Documented history', 'Smoother team transitions', 'A stronger starting point'] },
];
function Audiences() { return <>
  <SubHero eyebrow="WHO IT'S FOR" title="Different roles." accent="One shared understanding." description="Campaign Seat is designed for the people who keep campaigns running — during the work, through the transitions, and into whatever comes next." note="Keep the people behind the work connected." />
  <section className={styles.section} data-reveal><div className={styles.wrap}><div className={styles.audienceGrid}>{audiences.map((a,i)=><article key={a.title}><span className={styles.audienceCounter}>0{i+1} / {a.tag}</span><h2>{a.title}</h2><p>{a.description}</p><ul>{a.wins.map(w=><li key={w}><Check size={16}/>{w}</li>)}</ul></article>)}</div></div></section>
  <section className={`${styles.section} ${styles.sectionSoft}`}><div className={`${styles.wrap} ${styles.editorialGrid}`}><div><Eyebrow>THE NEXT CHAPTER</Eyebrow><h2>When the election ends,<br/><em>your knowledge doesn't have to.</em></h2></div><div><p>Campaign relationships, commitments, and the story behind them can remain valuable even after a race is over. The right records should remain accessible to the people authorized to use them.</p><p className={styles.smallNote}>Campaign records and official government-office records can be subject to different retention, ethics and access requirements. Campaign Seat does not replace those obligations.</p></div></div></section>
  <BottomCTA title="Let's talk about your team." description="Tell us how your organization works today. We'll tailor the private walkthrough to the challenges you want to solve." />
</>; }

function Trust() { return <>
  <SubHero eyebrow="TRUST & SECURITY" title="Shared context." accent="The right boundaries." description="A campaign's relationships and communications are sensitive. Campaign Seat is designed around individual access and private team workspaces — not shared logins or public records." note="Trust is built through real controls, not buzzwords." />
  <section className={styles.section} data-reveal><div className={styles.wrap}><div className={styles.trustCards}>
    {[
      ['Private campaign workspaces','Campaign information is organized within separate workspaces rather than one public collection.',LockKeyhole],
      ['Individual user accounts','Team members use individual identities instead of sharing one account.',Users],
      ['Role-aware access',"Access and available actions depend on the user's assigned role and permissions.",ShieldCheck],
      ['Leadership MFA','Leadership roles use multi-factor authentication for an additional account-security step.',CheckCircle2],
    ].map(([title,desc,Icon])=><article key={title}><div><Icon size={23}/></div><h3>{title}</h3><p>{desc}</p></article>)}
  </div></div></section>
  <section className={`${styles.section} ${styles.sectionSoft}`}><div className={`${styles.wrap} ${styles.editorialGrid}`}><div><Eyebrow>WHAT WE WILL AND WON'T CLAIM</Eyebrow><h2>Clear expectations<br/><em>are part of trust.</em></h2></div><div><p>Campaign Seat is an invitation-only platform in private beta. Security and connected-service features are tested and continue to evolve as the product grows. We do not advertise unverified certifications or promise automatic collection of every private communication.</p><p>For information about how the service handles data and user responsibilities, see our <a href="/privacy/">Privacy Policy</a> and <a href="/terms/">Terms & Conditions</a>.</p></div></div></section>
  <BottomCTA title="See the platform in a private setting." description="We'll walk through relevant access controls and workflows with your team before inviting you into the beta." />
</>; }

function About() { return <>
  <SubHero eyebrow="OUR PURPOSE" title="Campaign work moves fast." accent="The details deserve to last." description="Every campaign relies on people doing difficult work across communications, marketing, outreach, operations and leadership. Campaign Seat is focused on the common challenge beneath it all: keeping everyone connected to the right information." note="Software built around coordination, context and responsibility." />
  <section className={styles.section} data-reveal><div className={`${styles.wrap} ${styles.editorialGrid}`}><div><Eyebrow>WHY CAMPAIGN SEAT EXISTS</Eyebrow><h2>The political world moves on conversation.<br/><em>Too much context stays behind.</em></h2></div><div><p>Campaign teams operate under deadlines. A plan can change overnight. Communications, designers, organizers, volunteers and managers all contribute to the work — but decisions, relationships and accountability often get separated across inboxes, documents and people's memory.</p><p>Campaign Seat is being built around that everyday reality: organize the people, document the context, keep the work moving, and make handoffs easier when staff and priorities change.</p><p>We believe professional campaign software should serve the people doing the work, not ask them to assemble the whole story after the fact.</p></div></div></section>
  <section className={`${styles.section} ${styles.sectionSoft}`} data-reveal><div className={styles.wrap}><div className={styles.sectionHeading}><div><Eyebrow>WHAT GUIDES THE PRODUCT</Eyebrow><h2>Focused on the work.<br/><em>Built for the long view.</em></h2></div><p>Our approach is intentional: clear responsibilities, usable records, straightforward workflows and honest communication about what's available in beta.</p></div><div className={styles.v114Values}><article><Users size={26}/><h3>Real campaign roles</h3><p>Campaign managers, communications directors, marketing contributors, organizers and volunteers see different responsibilities.</p></article><article><MessageSquareText size={26}/><h3>Communication first</h3><p>We focus on the context around messages, decisions, meetings and relationships — not simply on sending more messages.</p></article><article><ShieldCheck size={26}/><h3>Responsible access</h3><p>Keep customer information private and share the right context with authorized members of a campaign team.</p></article></div></div></section>
  <section className={styles.section} data-reveal><div className={`${styles.wrap} ${styles.editorialGrid}`}><div><Eyebrow>THE COMPANY</Eyebrow><h2>Campaign Seat is a dedicated software platform.<br/><em>Private beta today.</em></h2></div><div><p>Campaign Seat is independently presented as its own customer-facing software brand. We are inviting a small number of campaign teams to test the product, share feedback and help define the most useful workflows.</p><p className={styles.smallNote}>For legal and contracting transparency, Campaign Seat is operated by CC INNOVATION GROUP LLC. Product demonstrations, access and support are handled under the Campaign Seat brand.</p><ArrowLink href="/walkthrough/">Meet the Campaign Seat team</ArrowLink></div></div></section>
  <BottomCTA title="Let's make the next campaign handoff better." description="Tell us about your team and communication workflow. We will show you the platform privately and discuss what can help today."/>
</>; }

function Walkthrough() {
  const [state,setState] = useState({ status:'idle',error:'' });
  const [startedAt] = useState(() => Date.now());
  const [fields,setFields] = useState({ name:'',email:'',organization:'',role:'',priority:'',message:'',website:'' });
  const [agreed,setAgreed] = useState(false);
  const statusRef = useRef(null);
  const onField = e => setFields(prev=>({...prev,[e.target.name]:e.target.value}));
  useEffect(()=>{if(state.status!=='idle')statusRef.current?.focus();},[state.status]);
  const send = async e => {
    e.preventDefault();
    if (!agreed) {setState({status:'error',error:'Please acknowledge the privacy notice before preparing your request.'});return;}
    // Direct email is the verified preview workflow. Do not claim an API inquiry was delivered.
    if (import.meta.env.VITE_CAMPAIGN_SEAT_FORM_DELIVERY !== 'enabled') {
      window.location.href = mailto;
      setState({status:'email-draft',error:''});
      return;
    }
    setState({status:'sending',error:''});
    try {
      const response = await fetch('/api/request-walkthrough',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,startedAt,privacyAccepted:agreed})});
      let result={}; try{result=await response.json();}catch{ /* response is not JSON */ }
      if(!response.ok||!result.ok) throw new Error(result.message||'The request could not be delivered. Please use the email option below.');
      setState({status:'sent',error:''});
    } catch(error) {setState({status:'error',error:error.message||'We could not send the request. Please contact us directly.'});}
  };
  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent('Campaign Seat — private walkthrough inquiry')}&body=${encodeURIComponent(`Hello Campaign Seat team,\n\nI'd like to request a walkthrough.\n\nName: ${fields.name}\nEmail: ${fields.email}\nOrganization: ${fields.organization}\nRole: ${fields.role}\nPriority: ${fields.priority}\n\n${fields.message}`)}`;
  return <>
    <section className={styles.contactHero}><div className={styles.wrap}><Eyebrow dark>PERSONAL PRODUCT WALKTHROUGH</Eyebrow><h1>Let's see what matters<br/><em>to your team.</em></h1><p>Tell us a little about your campaign or organization. We'll discuss your goals and show the actual software privately.</p></div></section>
    <section className={styles.contactSection}><div className={`${styles.wrap} ${styles.contactGrid}`}>
      <div className={styles.contactInfo}><span className={styles.contactSmall}>WHAT TO EXPECT</span><h2>A conversation first. A walkthrough built around you.</h2>
        <div className={styles.contactSteps}><div><b>01</b><p><strong>Tell us what you're trying to organize.</strong><span>Communication context, relationships, next steps or team continuity.</span></p></div><div><b>02</b><p><strong>We'll discuss the right fit.</strong><span>We'll learn how your team works and which capabilities are relevant.</span></p></div><div><b>03</b><p><strong>Explore the software privately.</strong><span>Beta access is reviewed individually, not created through public signup.</span></p></div></div>
        <div className={styles.contactReassurance}><LockKeyhole size={18}/><span>No public portal access. No commitment to purchase. A personal introduction to Campaign Seat.</span></div>
      </div>
      <div className={styles.formCard}><div className={styles.formHeading}><span>PRIVATE BETA INQUIRY</span><h2>Request a walkthrough</h2><p>Fields marked * are required.</p></div>
      {state.status==='email-draft' && <div className={styles.v114EmailNotice} role="status" tabIndex={-1} ref={statusRef}><Mail size={19}/><span>Your email application should open with a prepared request. <strong>Review it and press Send</strong> to contact us. No inquiry has been submitted automatically.</span></div>}
      {state.status==='sent'?<div className={styles.formSuccess} role="status" tabIndex={-1} ref={statusRef}><CheckCircle2 size={36}/><h3>Request received.</h3><p>Thank you for reaching out. The Campaign Seat team will review your inquiry and follow up using the details you provided.</p><a href="/">Back to homepage <ArrowRight size={16}/></a></div>:<form onSubmit={send} className={styles.formBody}>
        <div className={styles.formRow}><label>Full name *<input name="name" value={fields.name} onChange={onField} required minLength={2} maxLength={100} autoComplete="name" placeholder="Your name"/></label><label>Work email *<input name="email" value={fields.email} onChange={onField} required type="email" maxLength={180} autoComplete="email" placeholder="you@organization.com"/></label></div>
        <label>Campaign or organization *<input name="organization" value={fields.organization} onChange={onField} required maxLength={160} placeholder="Organization name" autoComplete="organization"/></label>
        <div className={styles.formRow}><label>Your role *<select required name="role" value={fields.role} onChange={onField}><option value="">Select a role</option><option>Campaign leadership</option><option value="Communications">Communications / marketing</option><option>Operations / staff</option><option>Candidate</option><option>Other</option></select></label><label>Most interested in *<select required name="priority" value={fields.priority} onChange={onField}><option value="">Select an area</option><option>Communication history</option><option>Contact relationships</option><option>Team coordination</option><option>Post-election continuity</option><option>A complete walkthrough</option></select></label></div>
        <label>What would you like to improve? <span className={styles.optional}>(optional)</span><textarea rows={4} maxLength={1500} name="message" value={fields.message} onChange={onField} placeholder="A few sentences about your team or workflow"/></label>
        <div className={styles.honeypot} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" name="website" value={fields.website} onChange={onField} /></label></div>
        <label className={styles.formConsent}><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/><span>I understand Campaign Seat may use these details to respond to my request, as described in the <a href="/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
        {state.status==='error'&&<div className={styles.formError} role="alert" tabIndex={-1} ref={statusRef}>{state.error}</div>}
        <button className={styles.formButton} type="submit" disabled={state.status==='sending'}>{state.status==='sending'?'Sending…':import.meta.env.VITE_CAMPAIGN_SEAT_FORM_DELIVERY === 'enabled'?'Send my request':'Prepare email request'}<ArrowRight size={18}/></button>
        <p className={styles.formFallback}>Requests currently open in your email app; please press Send to deliver. Prefer a direct email? <a href={mailto}>Contact the Campaign Seat team directly <ArrowUpRight size={13}/></a></p>
        <small className={styles.formDisclosure}>This website accepts no account credentials or campaign contact lists. Please do not include sensitive campaign information in this form.</small>
      </form>}
      </div>
    </div></section>
  </>;
}

export default function Site({ page='home' }) {
  useEffect(()=>{
    const root=document.querySelector('#campaign-seat-v114');
    if(!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add(styles.v114Revealed);io.unobserve(entry.target);}}),{threshold:0.06,rootMargin:'0px 0px -30px 0px'});
    root.querySelectorAll('[data-reveal]').forEach(el=>io.observe(el));
    root.classList.add(styles.v114MotionReady);
    return ()=>{io.disconnect();root.classList.remove(styles.v114MotionReady);};
  },[page]);
  useEffect(()=>{
    const m=SEO[page]||SEO.home;
    document.title=m.title;
    const desc=document.querySelector('meta[name="description"]'); if(desc)desc.setAttribute('content',m.description);
    const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.setAttribute('href','https://campaignseat.com'+m.path);
    const ogTitle=document.querySelector('meta[property="og:title"]');if(ogTitle)ogTitle.setAttribute('content',m.title);
    const ogDesc=document.querySelector('meta[property="og:description"]');if(ogDesc)ogDesc.setAttribute('content',m.description);
    const ogUrl=document.querySelector('meta[property="og:url"]');if(ogUrl)ogUrl.setAttribute('content','https://campaignseat.com'+m.path);
  },[page]);
  const Body={home:Home,platform:Platform,communications:Communications,audiences:Audiences,trust:Trust,about:About,contact:Walkthrough}[page]||Home;
  return <div id="campaign-seat-v114" className={styles.site}><Header/><main id="main-content"><Body/></main><Footer/></div>;
}
