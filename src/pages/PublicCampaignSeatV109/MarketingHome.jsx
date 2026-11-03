import { useEffect, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Activity, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, FileText, BarChart3, Package, Flag, Settings, CreditCard, CircleHelp, Megaphone, Radio, Clock3, CalendarCheck, HeartHandshake, Target,
  FolderClosed, History, Inbox, LayoutDashboard, LockKeyhole, Mail, Menu,
  MessageCircle, MessageSquareText, MoreHorizontal, PanelLeft, Search, Shield,
  ShieldCheck, Sparkles, Users, X,
} from 'lucide-react';
import styles from './MarketingHome.module.css';

const SUPPORT_EMAIL = 'support@ccinnovationgroupllc.com';
const DEMO_EMAIL = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Campaign Seat — Private beta walkthrough')}&body=${encodeURIComponent('Hello Campaign Seat team,\n\nI would like a walkthrough of Campaign Seat for our campaign or organization.\n\nOrganization / campaign:\nYour name:\nBest way to contact you:\n\nThank you.')}`;

const tourGroups = [
  {id:'workspace',label:'Everyday workspace', short:'Daily work'},
  {id:'campaign',label:'Campaign operations',short:'Campaign tools'},
  {id:'platform',label:'Platform & account',short:'Platform'},
];

// Sections mirror the Campaign Seat navigation. Descriptions explain the intended
// purpose of each area; all examples below are illustrative, not live account data.
const views = [
  {id:'hq',group:'workspace',title:'Campaign HQ',label:'HQ',icon:LayoutDashboard,desc:'See priorities, follow-ups, and campaign activity in one command view.'},
  {id:'inbox',group:'workspace',title:'Inbox',label:'Inbox',icon:Inbox,desc:'Keep internal messages and communication context accessible to your team.'},
  {id:'calendar',group:'workspace',title:'Calendar',label:'Calendar',icon:CalendarDays,desc:'See upcoming meetings, events and important dates.',examples:['Campaign transition meeting','Community partner check-in','Team planning session']},
  {id:'tasks',group:'workspace',title:'Tasks',label:'Tasks',icon:ClipboardCheck,desc:'Assign next steps, deadlines and follow-through to the right people.'},
  {id:'commitments',group:'workspace',title:'Commitments',label:'Commitments',icon:CheckCircle2,desc:'Keep promises and obligations visible until they are fulfilled.',examples:['Send follow-up summary','Share requested resources','Confirm next meeting']},
  {id:'waiting',group:'workspace',title:'Waiting On',label:'Waiting On',icon:Clock3,desc:'See who you are waiting to hear from and what is still unresolved.',examples:['Response from community partner','Document approval from team','Meeting confirmation']},
  {id:'contacts',group:'workspace',title:'Contacts & history',label:'Contacts',icon:Users,desc:'Connect each person to their relationship and communication history.'},
  {id:'documents',group:'workspace',title:'Documents',label:'Documents',icon:FolderClosed,desc:'Keep important files with the work and people they support.',examples:['Post-election transition notes','Partner outreach briefing','Team handoff documents']},
  {id:'approvals',group:'workspace',title:'Approvals',label:'Approvals',icon:ClipboardCheck,desc:'Organize requests, decisions and review status.',examples:['Communications review','Document sign-off','Operations request']},
  {id:'team',group:'workspace',title:'Team',label:'Team',icon:Users,desc:'Understand team responsibilities, access and working relationships.',examples:['Campaign administrator','Team coordinator','Volunteer collaborator']},
  {id:'inventory',group:'workspace',title:'Inventory',label:'Inventory',icon:Package,desc:'Keep track of campaign materials and resource handoffs.',examples:['Remaining signs and supplies','Materials handoff','Storage and inventory notes']},
  {id:'field',group:'workspace',title:'Field Operations',label:'Field Operations',icon:Target,desc:'Coordinate assignments, updates and field-team handoffs.',examples:['Field assignment','Team completion update','Operations follow-up']},
  {id:'candidate',group:'campaign',title:'Candidate',label:'Candidate',icon:Flag,desc:'Keep candidate and campaign identity details organized.',examples:['Campaign profile','Public-facing details','Candidate materials']},
  {id:'volunteers',group:'campaign',title:'Volunteers',label:'Volunteers',icon:HeartHandshake,desc:'Coordinate volunteer relationships and assignments.',examples:['Volunteer directory','Availability and roles','Volunteer follow-up']},
  {id:'fundraising',group:'campaign',title:'Fundraising',label:'Fundraising',icon:BarChart3,desc:'Keep fundraising-related work, relationships and follow-ups visible.',examples:['Fundraising follow-up','Donor relationship notes','Team action items']},
  {id:'events',group:'campaign',title:'Events',label:'Events',icon:CalendarCheck,desc:'Organize event planning, participation and team responsibilities.',examples:['Event schedule','Team assignments','Post-event follow-through']},
  {id:'social',group:'campaign',title:'Social Media',label:'Social Media',icon:Megaphone,desc:'Coordinate content ideas, ownership and campaign messaging work.',examples:['Content to review','Upcoming post planning','Team notes']},
  {id:'media',group:'campaign',title:'Media Center',label:'Media Center',icon:Radio,desc:'Keep press materials, media contacts and communications work together.',examples:['Press inquiry notes','Approved media materials','Media follow-up']},
  {id:'reports',group:'campaign',title:'Reports & Analytics',label:'Reports & Analytics',icon:BarChart3,desc:'Review the information your team records to understand progress.',examples:['Open follow-ups overview','Team workflow status','Activity summary']},
  {id:'integrations',group:'platform',title:'Integrations',label:'Integrations',icon:PanelLeft,desc:'Review supported connections and available account integrations.',examples:['Connected account review','Supported channel settings','Integration status']},
  {id:'plan',group:'platform',title:'Plan & Usage',label:'Plan & Usage',icon:CreditCard,desc:'Find workspace plan details and usage information.',examples:['Workspace plan','Account usage','Plan information']},
  {id:'settings',group:'platform',title:'Settings',label:'Settings',icon:Settings,desc:'Manage profile, workspace preferences and account security.',examples:['Profile preferences','Notification settings','Security and access']},
  {id:'support',group:'platform',title:'Support',label:'Support',icon:CircleHelp,desc:'Find help and assistance when your team needs it.',examples:['Contact support','Account guidance','Product questions']},
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

function ModuleScreen({ view }) {
  return <div className={styles.screenContent}>
    <div className={styles.screenHeading}>
      <div><span className={styles.screenKicker}>WORKSPACE AREA · ILLUSTRATIVE VIEW</span>
        <h4>{view.title}</h4><p>{view.desc}</p></div>
      <span className={styles.countPill}>Example</span>
    </div>
    <div className={styles.genericFrame}>
      <div className={styles.genericPrimary}>
        <div className={styles.panelTitle}><strong>What this area helps you organize</strong><span>EXAMPLE WORKFLOW</span></div>
        {(view.examples || []).map((item, i)=><div className={styles.genericRow} key={item}>
          <span className={styles.genericRowIcon}>{i===0?<ClipboardCheck size={15}/>:i===1?<History size={15}/>:<CheckCircle2 size={15}/>}</span>
          <div><strong>{item}</strong><small>{i===0?'Bring the context together':i===1?'Keep the team informed':'Know what happens next'}</small></div>
          <ArrowRight size={14} aria-hidden="true"/>
        </div>)}
      </div>
      <div className={styles.genericAside}>
        <span className={styles.genericAsideIcon}><view.icon size={28}/></span>
        <small>CONNECTED CAMPAIGN WORK</small>
        <h5>{view.title}</h5>
        <p>{view.desc}</p>
        <div><ShieldCheck size={15}/> Your team's roles shape what they can access.</div>
      </div>
    </div>
  </div>;
}

function ProductBrowser({ active, setActive, compact = false }) {
  const selected = views.find(v=>v.id===active) || views[0];
  const Screen = screenNodes[active];
  const sideViews = compact ? views.slice(0,4) : views;
  return <div className={`${styles.productBrowser} ${compact ? styles.browserCompact : ''}`}>
    <div className={styles.browserChrome}><span className={styles.browserDots}><i/><i/><i/></span><span className={styles.browserAddress}><Shield size={12}/> Campaign Seat · interface walkthrough</span><span className={styles.browserChromeRight}><LockKeyhole size={12}/> ILLUSTRATIVE PREVIEW</span></div>
    <div className={styles.browserApp}>
      <aside className={styles.appSide} aria-label="Example portal navigation">
        <div className={styles.sideBrand}>CS<span>Campaign Seat</span></div>
        {!compact && <small>PORTAL SECTIONS</small>}
        {sideViews.map(v=><button key={v.id} type="button" className={`${styles.sideItem} ${active===v.id?styles.sideItemActive:''}`} onClick={()=>setActive(v)} aria-label={`Preview ${v.title}`} aria-pressed={active===v.id}><v.icon size={14}/><span>{v.label}</span></button>)}
        {compact && <div className={styles.sideBottom}><ShieldCheck size={13}/> Role-aware access</div>}
      </aside>
      <div className={styles.browserMain}>
        <div className={styles.appTopBar}><div><span>EXAMPLE CAMPAIGN WORKSPACE</span><strong>Illustrative team portal</strong></div><div className={styles.topRight}><span><Sparkles size={13}/> Campaign intelligence</span><span className={styles.topBell}><Bell size={14}/></span><span className={styles.topProfile}>EC</span></div></div>
        {Screen?<Screen/>:<ModuleScreen view={selected}/>}
      </div>
    </div>
    <div className={styles.previewNote}><span><CheckCircle2 size={12}/> Based on Campaign Seat portal sections</span><span>Illustrative examples · No real contact records</span></div>
  </div>;
}

const featureCards = [
  {icon:History,number:'01',title:'Keep the whole conversation',text:'Connect notes, meeting context, contact history and next steps instead of leaving the story in separate inboxes.'},
  {icon:Users,number:'02',title:'Remember every relationship',text:'Give the team more than a name and phone number: preserve the background and context that make relationships useful.'},
  {icon:ClipboardCheck,number:'03',title:'Turn context into follow-through',text:'Track commitments, assignments and waiting-on items so important conversations lead to accountable action.'},
  {icon:ShieldCheck,number:'04',title:'Keep knowledge with the team',text:'Individual accounts, role-aware access and leadership MFA help preserve continuity when team members change.'},
];

const faq = [
  ['Does Campaign Seat replace our email or text messaging?', 'No. It complements the channels your team already uses. You can document important conversations and context in Campaign Seat. Connected communication features depend on the services configured for each workspace.'],
  ['Is this only for campaigns that won?', 'No. Whether a campaign wins, loses or transitions into another chapter, its contacts, decisions, documents and relationship history still matter.'],
  ['Can we import all of our past conversations automatically?', 'Not automatically from every service. During a walkthrough, we review the tools you use and the supported options for getting relevant information into your campaign workspace.'],
  ['How do we get access?', 'Campaign Seat is in a limited private beta. Request a walkthrough and our team can discuss whether the current version fits your workflows.'],
];

function SiteHeader() {
  const [opened,setOpened]=useState(false);
  return <>
    <div className={styles.announcement}><span className={styles.announcementDot}/> CAMPAIGN SEAT PRIVATE BETA <span className={styles.announcementDivider}>/</span> <a href="#contact">Explore the platform and request a walkthrough <ArrowRight size={13}/></a></div>
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Brand/>
        <nav className={styles.desktopNav} aria-label="Website navigation"><a href="#why">Why it matters</a><a href="#benefits">What makes it different</a><a href="#tour">Explore the portal</a><a href="#faq">FAQ</a></nav>
        <div className={styles.navActions}><CTA dark>Request a walkthrough</CTA></div>
        <button type="button" className={styles.mobileToggle} aria-label={opened?'Close menu':'Open menu'} aria-expanded={opened} onClick={()=>setOpened(!opened)}>{opened?<X size={23}/>:<Menu size={23}/>}</button>
      </div>
      {opened&&<nav className={styles.mobileNav} aria-label="Mobile navigation" onClick={()=>setOpened(false)}><a href="#why">Why it matters</a><a href="#benefits">What makes it different</a><a href="#tour">Explore the portal</a><a href="#faq">FAQ</a><a href="#contact">Request a walkthrough</a></nav>}
    </header>
  </>;
}

export default function MarketingHomeV109() {
  const [active,setActive]=useState('hq');
  const [tourGroup,setTourGroup]=useState('workspace');
  const visibleViews=views.filter(v=>v.group===tourGroup);
  const selected=views.find(v=>v.id===active)||views[0];
  function chooseGroup(groupId) {
    setTourGroup(groupId);
    const first=views.find(v=>v.group===groupId);
    if(first) setActive(first.id);
  }
  function chooseView(view) { setActive(view.id); setTourGroup(view.group); }
  useEffect(()=>{
    document.title='Campaign Seat | Every conversation. One shared campaign record.';
    const content='Campaign Seat keeps your team’s contacts, conversation history, follow-ups, documents and work connected in one campaign workspace. Explore the portal and request a private walkthrough.';
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
            <span className={styles.eyebrow}><span className={styles.eyebrowDash}/> THE CAMPAIGN KNOWLEDGE WORKSPACE</span>
            <h1>Every conversation matters.<br/><em>Keep the whole story.</em></h1>
            <p className={styles.heroDescription}>Contacts, communication history, decisions, documents and follow-ups—connected in one organized home. So when the election ends or the team changes, the important context stays.</p>
            <div className={styles.heroActions}><CTA>Request a walkthrough</CTA><a href="#tour" className={styles.heroSecondary}>Explore the portal <ArrowRight size={17}/></a></div>
            <div className={styles.heroProof}><span><History size={17}/> Communication history</span><span><Users size={17}/> Shared team knowledge</span><span><ShieldCheck size={17}/> Role-aware access</span></div>
          </div>
          <div className={styles.heroVisual} aria-label="Illustrative campaign portal preview">
            <div className={styles.visualBackplate}/>
            <div className={styles.heroWindow}><ProductBrowser active={active} setActive={chooseView} compact /></div>
            <div className={styles.floatCard}><span><History size={18}/></span><div><small>THE DETAILS MATTER</small><strong>People, history, next steps. Together.</strong></div></div>
          </div>
        </div>
      </section>

      <section className={styles.reframe} id="why">
        <div className={styles.container}>
          <div className={styles.valueIntro}>
            <span className={styles.sectionEyebrow}>WHY CAMPAIGN SEAT EXISTS</span>
            <h2>Scattered communications make teams start from scratch.</h2>
            <p>Emails in one inbox. Texts on another phone. Notes in a spreadsheet. Commitments in somebody's memory. Campaign Seat creates a shared record of the important context, so your team can find it and act on it.</p>
          </div>
          <div className={styles.differenceStrip}>
            <div><span><MessageCircle size={18}/></span><strong>Beyond the message</strong><small>Keep context attached to the contact, not just a thread.</small></div>
            <div><span><History size={18}/></span><strong>Beyond Election Day</strong><small>Keep the history when the next chapter begins.</small></div>
            <div><span><ClipboardCheck size={18}/></span><strong>Beyond a spreadsheet</strong><small>Connect the conversation to its owner and next step.</small></div>
          </div>
        </div>
      </section>

      <section className={styles.platform} id="benefits"><div className={styles.container}>
        <div className={styles.valueHeader}><div><span className={styles.sectionEyebrow}>MORE THAN A TOOL FOR ELECTION DAY</span><h2>What makes Campaign Seat different.</h2></div><p>Most teams already have ways to message, schedule and store files. Campaign Seat is built to keep the <strong>relationship, history and next action</strong> connected across that work.</p></div>
        <div className={styles.featureGrid}>{featureCards.map(f=><article className={styles.featureCard} key={f.number}><div className={styles.featureTop}><span className={styles.featureIcon}><f.icon size={23} strokeWidth={1.75}/></span><span className={styles.featureNumber}>{f.number}</span></div><h3>{f.title}</h3><p>{f.text}</p></article>)}</div>
      </div></section>

      <section className={styles.tourSection} id="tour"><div className={styles.container}>
        <div className={styles.tourHeading}><div><span className={styles.sectionEyebrow}>INSIDE THE CAMPAIGN SEAT PORTAL</span><h2>Explore the whole workspace.</h2></div><p>Choose a portal area to see how it helps your team. Examples are illustrative; access and availability vary by workspace.</p></div>
        <div className={styles.tourGroupTabs} role="group" aria-label="Portal section groups">
          {tourGroups.map(g=><button type="button" key={g.id} className={tourGroup===g.id?styles.tourGroupActive:''} aria-pressed={tourGroup===g.id} onClick={()=>chooseGroup(g.id)}>{g.label}<span>{views.filter(v=>v.group===g.id).length}</span></button>)}
        </div>
        <div className={styles.tourControls} role="tablist" aria-label="Preview portal areas">
          {visibleViews.map(v=><button key={v.id} id={`tour-tab-${v.id}`} role="tab" aria-selected={active===v.id} aria-controls="tour-panel" type="button" onClick={()=>chooseView(v)} className={`${styles.tourTab} ${active===v.id?styles.tourTabActive:''}`}><v.icon size={15}/>{v.title}</button>)}
        </div>
        <div className={styles.tourFrame} id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${active}`}>
          <div className={styles.tourIntro}><div><span>YOU'RE VIEWING <ArrowRight size={13}/></span><strong>{selected.title}</strong></div><p>{selected.desc}</p></div>
          <ProductBrowser active={active} setActive={chooseView}/>
        </div>
        <div className={styles.tourFoot}><span><ShieldCheck size={16}/> Illustrative portal tour · Fictional records only</span><a href={DEMO_EMAIL}>Walk through the real app with us <ArrowUpRight size={16}/></a></div>
      </div></section>

      <section className={styles.stepsSection} id="how-it-works"><div className={styles.container}>
        <div className={styles.workflowIntro}><span className={styles.sectionEyebrow}>A SIMPLE WAY TO WORK</span><h2>Capture the context. Connect the people. Know what's next.</h2></div>
        <div className={styles.stepsGrid}>
          <div><span>01 / RECORD</span><h3>Keep the conversation</h3><p>Document calls, meetings and the information worth remembering.</p></div>
          <div><span>02 / CONNECT</span><h3>Give it context</h3><p>Link notes and documents to the right contacts and team work.</p></div>
          <div><span>03 / FOLLOW THROUGH</span><h3>Make it actionable</h3><p>Assign tasks, follow-ups, commitments and waiting-on items.</p></div>
        </div>
        <p className={styles.workflowSecurity}><ShieldCheck size={17}/> Individual accounts · Role-aware workspace access · Leadership MFA</p>
      </div></section>

      <section className={styles.faqSection} id="faq"><div className={styles.container}><div><span className={styles.sectionEyebrow}>BEFORE YOUR WALKTHROUGH</span><h2>Good questions.<br/>Clear answers.</h2><p>We focus on the workflows your team actually needs—not promises about unsupported integrations.</p></div><div className={styles.faqList}>{faq.map(([q,a])=><details key={q}><summary>{q}<ChevronDown size={19} aria-hidden="true"/></summary><p>{a}</p></details>)}</div></div></section>

      <section className={styles.beta} id="contact"><div className={styles.container}><div className={styles.betaBadge}><span/> LIMITED PRIVATE BETA</div><h2>Keep what your<br/><i>campaign has built.</i></h2><p>See how Campaign Seat can help your team organize communication history, relationships and the work that follows.</p><div className={styles.betaActions}><CTA>Request a private walkthrough</CTA></div><div className={styles.betaFine}>Access is invitation-only · A walkthrough is the first step</div></div></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><div className={styles.footerMain}><div><Brand light/><p>One home for your campaign's people, conversations and next chapter.</p></div><div className={styles.footerLinks}><div><strong>Explore</strong><a href="#why">Why Campaign Seat</a><a href="#benefits">What makes it different</a><a href="#tour">Full portal tour</a></div><div><strong>Information</strong><a href="/privacy/">Privacy policy</a><a href="/terms/">Terms & conditions</a><a href="/sms-consent/">SMS consent</a></div><div><strong>Contact</strong><a href={DEMO_EMAIL}>Request a walkthrough</a><a href={`mailto:${SUPPORT_EMAIL}`}>Support</a><a href="https://ccinnovationgroupllc.com/" target="_blank" rel="noreferrer">CC Innovation Group <ArrowUpRight size={12}/></a></div></div></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} CC INNOVATION GROUP LLC. Campaign Seat is operated by CC INNOVATION GROUP LLC.</span><span>Keep the history. Move forward.</span></div></div></footer>
  </div>;
}
