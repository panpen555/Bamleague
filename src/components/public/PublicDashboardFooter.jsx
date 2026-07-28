import React from "react";

const SocialIcon = ({ platform }) => {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    fill: "currentColor",
    "aria-hidden": "true",
  };

  if (platform === "Facebook") {
    return (
      <svg {...commonProps}>
        <path d="M13.8 22v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H8V14h2.6v8h3.2Z" />
      </svg>
    );
  }
  if (platform === "Instagram") {
    return (
      <svg {...commonProps}>
        <path d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm-.2 2A3 3 0 0 0 4 7v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.3 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    );
  }
  if (platform === "TikTok") {
    return (
      <svg {...commonProps}>
        <path d="M14.4 2h3.1c.2 1.8 1.2 3.3 3 4.1v3.2a8.2 8.2 0 0 1-3-1v7.3a6.4 6.4 0 1 1-5.5-6.3v3.2a3.2 3.2 0 1 0 2.4 3.1V2Z" />
      </svg>
    );
  }
  return (
    <svg {...commonProps}>
      <path d="M22.5 7.1a3 3 0 0 0-2.1-2.2C18.5 4.4 12 4.4 12 4.4s-6.5 0-8.4.5a3 3 0 0 0-2.1 2.2A31 31 0 0 0 1 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.2c1.9.5 8.4.5 8.4.5s6.5 0 8.4-.5a3 3 0 0 0 2.1-2.2A31 31 0 0 0 23 12a31 31 0 0 0-.5-4.9ZM9.8 15.4V8.6l5.8 3.4-5.8 3.4Z" />
    </svg>
  );
};

function PublicDashboardFooter({
  kicker,
  title,
  description,
  socialLinks,
  onNavigate,
}) {
  return (
    <footer className="bam-public-footer">
      <div className="bam-public-footer-grid">
        <div className="bam-public-footer-brand">
          <span className="bam-public-footer-kicker">{kicker}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <nav className="bam-public-footer-nav" aria-label="Footer navigation">
          <h3>Explore</h3>
          {["overview", "teams", "schedule", "awards"].map((tab) => (
            <button key={tab} type="button" onClick={() => onNavigate(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <div className="bam-public-footer-social">
          <h3>Follow BAM League</h3>
          <div className="bam-public-follow-actions">
            {socialLinks.map(([platform, url]) =>
              url ? (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow BAM League on ${platform}`}
                  title={platform}
                  className="bam-public-social-link"
                >
                  <SocialIcon platform={platform} />
                </a>
              ) : (
                <button
                  key={platform}
                  type="button"
                  disabled
                  title="Coming soon"
                  aria-label={`${platform} coming soon`}
                  className="bam-public-social-link bam-public-social-link-disabled"
                >
                  <SocialIcon platform={platform} />
                </button>
              ),
            )}
          </div>
        </div>
      </div>
      <div className="bam-public-footer-copyright">
        © {new Date().getFullYear()} BAM League. All rights reserved.
      </div>
    </footer>
  );
}

export default PublicDashboardFooter;
