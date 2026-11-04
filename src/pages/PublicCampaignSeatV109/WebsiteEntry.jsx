import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import Site from '../PublicCampaignSeatV113/Site.jsx';
import PublicCampaignSeat from '../PublicCampaignSeat/PublicCampaignSeat.jsx';
import legalStyles from './MarketingHome.module.css';
import '../../styles/globals.css';

class PublicSiteErrorBoundary extends Component {
  constructor(props) { super(props); this.state = {hasError:false}; }
  static getDerivedStateFromError() { return {hasError:true}; }
  render() {
    if (this.state.hasError) return <main style={{maxWidth:680,margin:'100px auto',padding:24,fontFamily:'system-ui,sans-serif'}}>
      <h1>Campaign Seat</h1><p>This page could not load. Please refresh or contact support@ccinnovationgroupllc.com.</p><a href="/">Back to Campaign Seat</a>
    </main>;
    return this.props.children;
  }
}

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const legalRoutes = {'/privacy':'privacy','/terms':'terms','/sms-consent':'sms-consent'};
const siteRoutes = {'/':'home','/platform':'platform','/communications':'communications','/who-its-for':'audiences','/trust':'trust','/about':'about','/walkthrough':'contact'};
const legalPage = legalRoutes[path];
const sitePage = siteRoutes[path] || 'home';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PublicSiteErrorBoundary>
      {legalPage ? <div className={legalStyles.legalWrapper}><PublicCampaignSeat page={legalPage}/></div> : <Site page={sitePage} />}
    </PublicSiteErrorBoundary>
  </React.StrictMode>
);
