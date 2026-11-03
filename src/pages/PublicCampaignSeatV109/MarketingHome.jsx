import { useEffect, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Activity, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, FileText,
  FolderClosed, History, Inbox, LayoutDashboard, LockKeyhole, Mail, Menu,
  MessageCircle, MessageSquareText, MoreHorizontal, PanelLeft, Search, Shield,
  ShieldCheck, Sparkles, Users, X,
} from 'lucide-react';
import styles from './MarketingHome.module.css';

const APP_URL = 'https://app.campaignseat.com/';
const SUPPORT_EMAIL = 'support@ccinnovationgroupllc.com';
const DEMO_EMAIL = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Campaign Seat — Private beta walkthrough')}&body=${encodeURIComponent('Hello Campaign Seat team,\n\nI would like a walkthrough of Campaign Seat for our campaign or organization.\n\nOrganization / campaign:\nYour name:\nBest way to contact you:\n\nThank you.')}`;

const views = [
  { id: 'hq', title: 'Campaign HQ', label: 'HQ', icon: LayoutDashboard, desc: 'Start with the work, relationships, and follow-ups that need attention.' },
  { id: 'contacts', title: 'Contacts & history', label: 'Contacts', icon: Users, desc: 'Keep the relationship and its history together, not scattered across accounts.' },
  { id: 'inbox', title: 'Communication hub', label: 'Inbox', icon: Inbox, desc: 'Keep team messages and communication context in one organized place.' },
  { id: 'tasks', title: 'Tasks & follow-ups', label: 'Tasks', icon: ClipboardCheck, desc: 'Turn conversations into assigned work and clear next steps.' },
];

const people = [
  { initials: 'JE', name: 'Jordan Ellis', role: 'Community partner', type: 'Partner', color: 'blue', note: 'Meeting follow-up recorded', date: 'Today' },
  { initials: 'AM', name: 'Alex Morgan', role: 'Former field lead', type: 'Team', color: 'purple', note: 'Call notes added to record', date: 'Yesterday' },
  { initials: 'RB', name: 'Riley Brooks', role: 'Local organization', type: 'Organization', color: 'gold', note: 'Next check-in scheduled', date: 'Nov 1' },
  { initials: 'TS', name: 'Taylor Smith', role: 'Campaign advisor', type: 'Advisor', color: 'green', note: 'Document shared with team', date: 'Oct 30' },
];

function Initials({ value, color = 'blue' }) {
  return <span className={`${styles.avatar} ${styles[`avatar_${color}`]}`} aria-hidden="true">{value}</span>;
}

function Brand({ light = false }) {
  return <a href="/" className={`${styles.brand} ${light ? styles.brandLight : ''}`} aria-label="Campaign Seat home">
    <span className={styles.brandSymbol} aria-hidden="true"><span>C</span><i /></span>
    <span className={styles.brandName}>CAMPAIGN <b>SEAT</b></span>
  </a>;
}

function CTA({ children, dark = false, className = '' }) {
  return <a href={DEMO_EMAIL} className={`${styles.button} ${dark ? styles.buttonDark : ''} ${className}`}>
    {children}<ArrowUpRight size={17} strokeWidth={2.1} aria-hidden="true" />
  </a>;
}

function MiniMetric({ number, label, note, accent }) {
  return <div className={styles.metric}><div className={styles.metricLabel}>{label}</div><strong>{number}</strong><span className={accent ? styles.metricAccent : ''}>{note}</span></div>;
}

function HQScreen() {
  return <div className={styles.screenContent}>
    <div className={styles.screenHeading}><div><span className={styles.screenKicker}>OVERVIEW</span><h4>Your team's next chapter, organized.</h4><p>One place to see what matters and what comes next.</p></div><span className={styles.pill}><i /> Workspace active</span></div>
    <div className={styles.metrics}><MiniMetric number="12" label="Active follow-ups" note="3 due this week" accent /><MiniMetric number="48" label="Contact records" note="Organized by relationship" /><MiniMetric number="6" label="Team updates" note="Across your workspace" /></div>
    <div className={styles.screenColumns}>
      <div className={styles.panel}>
        <div className={styles.panelTitle}><strong>What needs attention</strong><span>THIS WEEK</span></div>
        <div className={styles.activityRow}><span className={`${styles.activityIcon} ${styles.iconRed}`}><MessageCircle size={15} /></span><div><strong>Follow up with Jordan Ellis</strong><small>Conversation recorded · Due tomorrow</small></div><span className={styles.rowPriority}>Due soon</span></div>
        <div className={styles.activityRow}><span className={`${styles.activityIcon} ${styles.iconBlue}`}><ClipboardCheck size={15} /></span><div><strong>Review transition notes</strong><small>Assigned to campaign operations</small></div><CheckCircle2 size={16} color="#81a3ba" /></div>
        <div className={styles.activityRow}><span className={`${styles.activityIcon} ${styles.iconGold}`}><FileText size={15} /></span><div><strong>Organize post-election records</strong><small>Documents · 4 linked items</small></div><span className={styles.rowTag}>In progress</span></div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTitle}><strong>Recent team activity</strong><span>HISTORY</span></div>
        {[
          ['A note was added to a contact', '3 min ago'],
          ['A follow-up was assigned', 'Earlier today'],
          ['A document was organized', 'Yesterday'],
        ].map(([name, time]) => <div className={styles.timelineRow} key={name}><span className={styles.timelineDot}/><div><strong>{name}</strong><small>{time}</small></div></div>)}
      </div>
    </div>
  </div>;
}

function ContactsScreen() {
  return <div className={styles.screenContent}>
    <div className={styles.screenHeading}><div><span className={styles.screenKicker}>CONTACT WORKSPACE</span><h4>Know the person. Remember the context.</h4><p>Relationships become more valuable when the history stays with them.</p></div><span className={styles.countPill}>48 contacts</span></div>
    <div className={styles.contactLayout}>
      <div className={`${styles.panel} ${styles.contactList}`}>
        <div className={styles.fakeSearch}><Search size={13}/> Search contacts and organizations</div>
        {people.map((p,i)=><div className={`${styles.contactRow} ${i===0 ? styles.selectedContact : ''}`} key={p.name}><Initials value={p.initials} color={p.color}/><div><strong>{p.name}</strong><small>{p.role}</small></div><span>{p.date}</span></div>)}
      </div>
      <div className={`${styles.panel} ${styles.contactDetail}`}>
        <div className={styles.contactIdentity}><Initials value="JE" color="blue"/><div><strong>Jordan Ellis</strong><small>Community partner · Active contact</small></div><span className={styles.rowTag}>Partner</span></div>
        <div className={styles.detailLabel}><History size={13}/> COMMUNICATION HISTORY</div>
        <div className={styles.recordEntry}><span className={styles.recordTrack}/><strong>Phone conversation</strong><small>Today · Summary documented</small><p>Discussed ongoing community relationships and next steps after the election.</p></div>
        <div className={styles.recordEntry}><span className={styles.recordTrack}/><strong>Meeting notes</strong><small>Oct 29 · Added by campaign team</small><p>Shared resources and future collaboration opportunities.</p></div>
        <div className={styles.detailNext}><CheckCircle2 size={15}/> Follow-up assigned for tomorrow</div>
      </div>
    </div>
  </div>;
}

function InboxScreen() {
  return <div className={styles.screenContent}>
    <div className={styles.screenHeading}><div><span className={styles.screenKicker}>COMMUNICATION HUB</span><h4>Less searching. More continuity.</h4><p>Conversations, decisions and context belong together.</p></div><span className={styles.countPill}>Team workspace</span></div>
    <div className={styles.inboxLayout}>
      <div className={`${styles.panel} ${styles.threadList}`}>
        <div className={styles.panelTitle}><strong>Recent conversations</strong><MoreHorizontal size={16}/></div>
        {[
          ['JE','Jordan Ellis','Follow-up after our call','Today','blue'],
          ['AM','Operations team','Transition planning','Yesterday','purple'],
          ['RB','Riley Brooks','Community partnership notes','Oct 30','gold'],
        ].map(([initials,name,sub,time,color],i)=><div className={`${styles.threadRow} ${i===0 ? styles.selectedThread : ''}`} key={name}><Initials value={initials} color={color}/><div><strong>{name}</strong><small>{sub}</small></div><em>{time}</em></div>)}
      </div>
      <div className={`${styles.panel} ${styles.threadDetail}`}>
        <div className={styles.threadHead}><strong>Follow-up after our call</strong><span>Jordan Ellis</span></div>
        <div className={styles.messageBubble}><span>Recorded context</span><p>Our team connected about continued community initiatives. We agreed to share a resource summary and reconnect next week.</p></div>
        <div className={styles.threadAction}><Check size={14}/> Linked to Jordan's contact record</div>
        <div className={styles.threadAction}><ClipboardCheck size={14}/> Follow-up tracked for the team</div>
      </div>
    </div>
  </div>;
}

function TasksScreen() {
  return <div className={styles.screenContent}>
    <div className={styles.screenHeading}><div><span className={styles.screenKicker}>FOLLOW-UP WORK</span><h4>A conversation is only the beginning.</h4><p>Turn important next steps into visible, accountable work.</p></div><span className={styles.countPill}>12 active</span></div>
    <div className={styles.taskBoard}>
      {[
        {name:'TO DO',count:4,items:[['Schedule partner follow-up','Jordan Ellis · Nov 5'],['Archive field team handoff','Campaign operations · Nov 7']]},
        {name:'IN PROGRESS',count:5,items:[['Organize communication notes','Records team · This week'],['Prepare transition brief','Campaign manager · Nov 6']]},
        {name:'COMPLETED',count:3,items:[['Confirm team access','Completed today'],['Review contact updates','Completed yesterday']]},
      ].map((col,i)=><div className={styles.taskCol} key={col.name}><div className={styles.taskColTitle}><span><i className={`${styles.taskStatus} ${styles[`taskStatus${i}`]}`}/>{col.name}</span><b>{col.count}</b></div>{col.items.map(([title,sub])=><div className={styles.taskItem} key={title}><span className={styles.taskItemIcon}>{i===2?<Check size={13}/>:<ClipboardCheck size={13}/>}</span><strong>{title}</strong><small>{sub}</small></div>)}</div>)}
    </div>
  </div>;
}

const screenNodes = { hq: HQScreen, contacts: ContactsScreen, inbox: InboxScreen, tasks: TasksScreen };

function ProductBrowser({ active, setActive, compact = false }) {
  const Screen = screenNodes[active] || HQScreen;
  return <div className={`${styles.productBrowser} ${compact ? styles.browserCompact : ''}`}>
    <div className={styles.browserChrome}><span className={styles.browserDots}><i/><i/><i/></span><span className={styles.browserAddress}><Shield size={12}/> app.campaignseat.com</span><span className={styles.browserChromeRight}><LockKeyhole size={12}/> SECURE WORKSPACE</span></div>
    <div className={styles.browserApp}>
      <aside className={styles.appSide}>
        <div className={styles.sideBrand}>CS<span>Campaign HQ</span></div>
        <small>YOUR WORKSPACE</small>
        {views.map(v=><button key={v.id} type="button" className={`${styles.sideItem} ${active===v.id?styles.sideItemActive:''}`} onClick={()=>setActive(v.id)} aria-label={`Preview ${v.title}`} aria-pressed={active===v.id}><v.icon size={14}/><span>{v.label}</span></button>)}
        <div className={styles.sideBottom}><ShieldCheck size={13}/> Role-aware access</div>
      </aside>
      <div className={styles.browserMain}>
        <div className={styles.appTopBar}><div><span>CAMPAIGN WORKSPACE</span><strong>Example Campaign</strong></div><div className={styles.topRight}><span><Sparkles size={13}/> Campaign intelligence</span><span className={styles.topBell}><Bell size={14}/></span><span className={styles.topProfile}>EC</span></div></div>
        <Screen />
      </div>
    </div>
    <div className={styles.previewNote}><span><CheckCircle2 size={12}/> Based on Campaign Seat's working modules</span><span>Illustrative data · No customer records shown</span></div>
  </div>;
}

const featureCards=[
  {icon:History,number:'01',title:'Conversation history',text:'Keep important calls, meetings, notes and communication context attached to the people and work they belong to.'},
  {icon:Users,number:'02',title:'Relationships & contacts',text:'Make contacts more than names in a spreadsheet. Give your team the context behind each relationship.'},
  {icon:Inbox,number:'03',title:'A shared communication hub',text:'Organize team messages and relevant communication activity so information is easier to find and follow.'},
  {icon:ClipboardCheck,number:'04',title:'Tasks & follow-through',text:'Track who owns the next step, what was promised and what still needs to happen.'},
  {icon:FolderClosed,number:'05',title:'Documents & records',text:'Keep documents and useful records connected to the campaign workflows they support.'},
  {icon:ShieldCheck,number:'06',title:'Role-aware team access',text:'Bring your team into a workspace with appropriate roles and account protection for leadership.'},
];

const faq=[
  ['Is Campaign Seat just for election season?', 'No. Campaign Seat is designed for the operational work during a campaign and for the continuity of relationships, records and follow-ups afterward.'],
  ['Does it replace email or text messaging?', 'Not necessarily. Teams can continue using their existing channels and document important context in Campaign Seat. Specific connected communication functions depend on configured services and the features available to each workspace.'],
  ['Can I see what the actual platform looks like?', 'Yes. Explore the interactive product walkthrough above. It mirrors the working Campaign HQ, Contacts, Inbox and Tasks areas using fictional example records. A live walkthrough is available by request.'],
  ['Can my team have different access levels?', 'Yes. Campaign Seat includes role-aware workspaces. Leadership access supports multi-factor authentication, and team permissions can differ by assigned role.'],
  ['Can we import everything automatically?', 'Not every source or communication channel has a universal automatic import. We first look at the tools and records your organization uses, then review which information can be brought into supported Campaign Seat workflows.'],
  ['Who operates Campaign Seat?', 'Campaign Seat is operated by CC INNOVATION GROUP LLC. It is currently welcoming a limited number of teams into a private beta.'],
];

function SiteHeader() {
  const [opened,setOpened]=useState(false);
  return <><div className={styles.announcement}><span className={styles.announcementDot}/> THE NEXT CHAPTER STARTS HERE <span className={styles.announcementDivider}>/</span> <a href="#beta">Private beta now welcoming campaign teams <ArrowRight size={13}/></a></div>
    <header className={styles.nav}>
      <div className={styles.navInner}><Brand/><nav className={styles.desktopNav} aria-label="Website navigation"><a href="#why">Why Campaign Seat</a><a href="#platform">The platform</a><a href="#tour">Product tour</a><a href="#faq">Questions</a></nav><div className={styles.navActions}><a href={APP_URL} className={styles.signIn}>Sign in <ArrowUpRight size={14}/></a><CTA dark>Request a walkthrough</CTA></div><button type="button" className={styles.mobileToggle} aria-label={opened?'Close menu':'Open menu'} aria-expanded={opened} onClick={()=>setOpened(!opened)}>{opened?<X size={23}/>:<Menu size={23}/>}</button></div>
      {opened&&<nav className={styles.mobileNav} aria-label="Mobile navigation" onClick={()=>setOpened(false)}><a href="#why">Why Campaign Seat</a><a href="#platform">The platform</a><a href="#tour">Product tour</a><a href="#faq">Questions</a><a href={APP_URL}>Sign in</a><a href={DEMO_EMAIL}>Request a walkthrough</a></nav>}
    </header>
  </>;
}

export default function MarketingHomeV109() {
  const [active,setActive]=useState('hq');
  useEffect(()=>{
    document.title='Campaign Seat | Keep the history. Move forward.';
    const content='Campaign Seat organizes campaign contacts, communication history, team activity, documents, and follow-ups in one secure, role-aware workspace. Explore the platform and request private beta access.';
    let tag=document.querySelector('meta[name="description"]');
    if(!tag){tag=document.createElement('meta');tag.name='description';document.head.appendChild(tag)}
    tag.content=content;
  },[]);
  return <div className={styles.site}>
    <SiteHeader/>
    <main>
      <section className={styles.hero} id="top">
        <div className={styles.heroGlow} aria-hidden="true"/>
        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><span className={styles.eyebrowDash}/> THE HOME FOR YOUR CAMPAIGN'S HISTORY</span>
            <h1>Your campaign moves on.<br/><em>Your knowledge</em> shouldn't.</h1>
            <p className={styles.heroDescription}>Every call, contact, decision and follow-up tells part of your campaign's story. Campaign Seat brings the important context into one organized workspace — so your team can always find where things stand.</p>
            <div className={styles.heroActions}><CTA>Request private beta access</CTA><a href="#tour" className={styles.heroSecondary}>Explore the platform <ArrowRight size={17}/></a></div>
            <div className={styles.heroProof}><span><ShieldCheck size={17}/> Role-aware workspace</span><span><History size={17}/> Communication history</span><span><Users size={17}/> Team continuity</span></div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.visualBackplate}/>
            <div className={styles.heroWindow}><ProductBrowser active={active} setActive={setActive} compact /></div>
            <div className={styles.floatCard}><span><History size={18}/></span><div><small>THE DETAILS MATTER</small><strong>One relationship. A complete story.</strong></div></div>
          </div>
        </div>
        <div className={styles.heroFoot}><span>BUILT FOR THE WORK BETWEEN THE BIG MOMENTS.</span><span>01 — CAMPAIGN CONTINUITY</span></div>
      </section>

      <section className={styles.reframe} id="why"><div className={styles.container}><div className={styles.reframeTop}><span className={styles.sectionEyebrow}>THE PROBLEM ISN'T A LACK OF CONVERSATIONS.</span><h2>It's where all those<br/><i>conversations end up.</i></h2></div><div className={styles.reframeGrid}><div className={styles.reframeBody}><p>Campaigns build extraordinary relationships. But the work gets scattered across inboxes, texts, spreadsheets, individual devices, meetings and memory.</p><p>When the election ends or the team changes, it's too easy for valuable information to disappear with it.</p><strong>Campaign Seat gives that knowledge a place to live.</strong></div><div className={styles.scattered}><div><Mail size={19}/><span>Emails</span></div><div><MessageCircle size={19}/><span>Texts & calls</span></div><div><FileText size={19}/><span>Notes</span></div><div><Users size={19}/><span>Contacts</span></div><div><CalendarDays size={19}/><span>Meetings</span></div><div className={styles.scatteredCenter}><span className={styles.miniBrand}>CS</span><strong>One organized<br/>campaign record</strong></div></div></div></div></section>

      <section className={styles.platform} id="platform"><div className={styles.container}><div className={styles.sectionHeader}><span className={styles.sectionEyebrow}>ONE WORKSPACE. THE WHOLE CONTEXT.</span><div><h2>Everything important<br/>has a place.</h2><p>Not another pile of tools. A clearer picture of the people, conversations, and work that move your campaign forward.</p></div></div><div className={styles.featureGrid}>{featureCards.map(f=><article className={styles.featureCard} key={f.number}><div className={styles.featureTop}><span className={styles.featureIcon}><f.icon size={24} strokeWidth={1.75}/></span><span className={styles.featureNumber}>{f.number}</span></div><h3>{f.title}</h3><p>{f.text}</p><span className={styles.featureBottom}><i/></span></article>)}</div></div></section>

      <section className={styles.tourSection} id="tour"><div className={styles.container}><div className={styles.tourHeading}><div><span className={styles.sectionEyebrow}>INSIDE CAMPAIGN SEAT</span><h2>See the workspace.<br/><i>See the difference.</i></h2></div><p>Explore the actual product areas your team will work in — through an interactive preview built with fictional example data.</p></div><div className={styles.tourControls} role="tablist" aria-label="Explore Campaign Seat features">{views.map(v=><button key={v.id} role="tab" aria-selected={active===v.id} type="button" onClick={()=>setActive(v.id)} className={`${styles.tourTab} ${active===v.id?styles.tourTabActive:''}`}><v.icon size={17}/>{v.title}</button>)}</div><div className={styles.tourFrame}><div className={styles.tourIntro}><div><span>NOW EXPLORING <ArrowRight size={13}/></span><strong>{views.find(v=>v.id===active)?.title}</strong></div><p>{views.find(v=>v.id===active)?.desc}</p></div><ProductBrowser active={active} setActive={setActive}/></div><div className={styles.tourFoot}><span><ShieldCheck size={16}/> Protected, role-aware campaign workspace</span><a href={DEMO_EMAIL}>Get a guided walkthrough <ArrowUpRight size={16}/></a></div></div></section>

      <section className={styles.story}><div className={styles.container}><div className={styles.storyLabel}><span className={styles.sectionEyebrow}>THE CAMPAIGN DOESN'T END WITH THE VOTE.</span><span className={styles.storyIndex}>CHAPTER TWO / KEEP MOVING</span></div><div className={styles.storyBody}><h2>Win or lose,<br/><i>the relationships still matter.</i></h2><div><p>The next chapter starts with what you've already built: relationships, lessons, commitments, decisions and a team that knows the story.</p><p>Keep that context organized while the people, roles and priorities around it change.</p><a href="#beta">Build what's next <ArrowUpRight size={18}/></a></div></div><div className={styles.storyStrips}><div><History size={19}/> History worth keeping</div><div><Users size={19}/> Relationships worth remembering</div><div><CheckCircle2 size={19}/> Next steps worth finishing</div></div></div></section>

      <section className={styles.stepsSection} id="how-it-works"><div className={styles.container}><div className={styles.sectionHeader}><span className={styles.sectionEyebrow}>THE WORKFLOW</span><div><h2>Capture it. Connect it.<br/>Come back to it.</h2><p>Powerful enough for a campaign, straightforward enough for the team doing the work.</p></div></div><div className={styles.stepsGrid}><div><span>01 / RECORD</span><div className={styles.stepIcon}><MessageSquareText size={26}/></div><h3>Keep the context</h3><p>Document the conversations and details that your team will need later.</p></div><div><span>02 / ORGANIZE</span><div className={styles.stepIcon}><PanelLeft size={26}/></div><h3>Give it a home</h3><p>Connect information to contacts, team work, documents and records.</p></div><div><span>03 / FOLLOW THROUGH</span><div className={styles.stepIcon}><Activity size={26}/></div><h3>Know what's next</h3><p>Assign follow-ups and find what happened without digging through old threads.</p></div></div></div></section>

      <section className={styles.security}><div className={styles.container}><div className={styles.securityIcon}><ShieldCheck size={30}/></div><div><span className={styles.sectionEyebrow}>BUILT FOR RESPONSIBLE ACCESS</span><h2>Shared information.<br/>Not shared passwords.</h2><p>Campaign Seat supports separate accounts, team roles and leadership multi-factor authentication. The information your campaign documents lives in a shared workspace, with access shaped by people's responsibilities.</p></div><div className={styles.securityPoints}><span><Check size={16}/> Individual user accounts</span><span><Check size={16}/> Role-aware permissions</span><span><Check size={16}/> Leadership MFA</span><span><Check size={16}/> Private campaign workspaces</span></div></div></section>

      <section className={styles.faqSection} id="faq"><div className={styles.container}><div><span className={styles.sectionEyebrow}>GOOD QUESTIONS. CLEAR ANSWERS.</span><h2>What teams<br/>want to know.</h2><p>We're building with real campaign workflows in mind. Here's what to expect as you explore.</p></div><div className={styles.faqList}>{faq.map(([q,a],i)=><details key={q} open={i===0}><summary>{q}<ChevronDown size={19} aria-hidden="true"/></summary><p>{a}</p></details>)}</div></div></section>

      <section className={styles.beta} id="beta"><div className={styles.container}><div className={styles.betaBadge}><span/> LIMITED PRIVATE BETA</div><h2>Give your campaign's<br/><i>history a future.</i></h2><p>We're inviting a small number of campaign teams to explore Campaign Seat, try real workflows and help shape the platform.</p><div className={styles.betaActions}><CTA>Request a private walkthrough</CTA><a href={APP_URL} className={styles.betaSignIn}>Already invited? Sign in <ArrowUpRight size={17}/></a></div><div className={styles.betaFine}>No public sign-up required. Beta access is reviewed individually.</div></div></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><div className={styles.footerMain}><div><Brand light/><p>A home for your campaign's people, conversations, and next chapter.</p></div><div className={styles.footerLinks}><div><strong>Explore</strong><a href="#why">Why Campaign Seat</a><a href="#platform">Features</a><a href="#tour">Product tour</a><a href={APP_URL}>Sign in</a></div><div><strong>Information</strong><a href="/privacy/">Privacy policy</a><a href="/terms/">Terms & conditions</a><a href="/sms-consent/">SMS consent</a></div><div><strong>Get in touch</strong><a href={DEMO_EMAIL}>Request a walkthrough</a><a href={`mailto:${SUPPORT_EMAIL}`}>Support</a><a href="https://ccinnovationgroupllc.com/" target="_blank" rel="noreferrer">CC Innovation Group <ArrowUpRight size={12}/></a></div></div></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} CC INNOVATION GROUP LLC. Campaign Seat is a software product operated by CC INNOVATION GROUP LLC.</span><span>Made for the work that lasts beyond the campaign.</span></div></div></footer>
  </div>;
}
