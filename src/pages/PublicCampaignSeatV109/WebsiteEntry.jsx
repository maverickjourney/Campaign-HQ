import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import MarketingHomeV109 from "./MarketingHome.jsx";
import PublicCampaignSeat from "../PublicCampaignSeat/PublicCampaignSeat.jsx";
import "../../styles/globals.css";

class PublicSiteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <main style={{ maxWidth: 640, margin: "96px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Campaign Seat</h1>
        <p>This page could not load. Please refresh or contact support@ccinnovationgroupllc.com.</p>
        <a href="/">Return to the homepage</a>
      </main>;
    }
    return this.props.children;
  }
}

function PublicWebsite() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = ({
    "/privacy": "privacy",
    "/terms": "terms",
    "/sms-consent": "sms-consent",
  })[path];
  return page ? <PublicCampaignSeat page={page} /> : <MarketingHomeV109 />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PublicSiteErrorBoundary><PublicWebsite /></PublicSiteErrorBoundary>
  </React.StrictMode>
);
