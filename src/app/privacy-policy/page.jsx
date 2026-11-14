const wrap = { maxWidth: '760px', margin: '0 auto', padding: '56px 20px 96px' };
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const h2s = { fontSize: '1.2rem', fontWeight: 700, marginTop: '40px', marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };

export default function PrivacyPolicyPage() {
  return (
    <div style={wrap}>
      <h1 style={h1s}>Privacy Policy</h1>
      <p style={{ ...ps, opacity: 0.75 }}><em>Effective date: November 15, 2026</em></p>

      <h2 style={h2s}>1. Who we are</h2>
      <p style={ps}>
        NewsShore ("we", "us", or "the publication") is an independent digital technology
        publication operated by [LEGAL ENTITY NAME], [COUNTRY]. This policy explains what
        personal information we collect when you visit this website, how we use it, and the
        choices available to you.
      </p>

      <h2 style={h2s}>2. Information we collect</h2>
      <p style={ps}>
        <strong>Information you provide.</strong> Reading NewsShore does not require an
        account. When you contact us by email — for inquiries, corrections, news tips, or
        advertising — we receive your email address and the contents of your message.
      </p>
      <p style={ps}>
        <strong>Information collected automatically.</strong> Like most websites, our hosting
        infrastructure and analytics tools collect standard technical data when you visit,
        such as your IP address, browser type and version, device type, referring page, the
        pages you visit, and the date and time of your visits.
      </p>
      <p style={ps}>
        <strong>Cookies.</strong> The website uses cookies and similar technologies. These are
        described in our Cookie Policy, which forms part of this policy.
      </p>

      <h2 style={h2s}>3. How we use information</h2>
      <ul style={{ marginTop: '6px', marginBottom: '14px', paddingLeft: '26px', lineHeight: 1.7 }}>
        <li>To operate, maintain, and secure the website</li>
        <li>To respond to your correspondence</li>
        <li>To understand readership in aggregate and improve our coverage</li>
        <li>To detect and address technical issues, fraud, and abuse</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2 style={h2s}>4. Legal bases (EEA and UK readers)</h2>
      <p style={ps}>
        Where the GDPR or UK GDPR applies, we process personal information on the following
        bases: your consent, where given (for example, for analytics cookies); our legitimate
        interests in operating and securing the publication; and compliance with legal
        obligations. Where processing is based on consent, you may withdraw it at any time.
      </p>

      <h2 style={h2s}>5. Sharing</h2>
      <p style={ps}>
        We do not sell personal information. We share it only with service providers that
        host and operate the website and provide analytics, under their own privacy
        commitments, and where required by law or to protect our rights and the safety of
        others.
      </p>

      <h2 style={h2s}>6. Retention</h2>
      <p style={ps}>
        Correspondence is retained for as long as necessary to handle the inquiry and for
        reasonable record-keeping. Analytics data is retained in aggregate form. Technical
        logs are retained according to the standard practice of our providers.
      </p>

      <h2 style={h2s}>7. Your rights</h2>
      <p style={ps}>
        Depending on your jurisdiction, you may have the right to request access to,
        correction, deletion, or restriction of your personal information, to object to
        certain processing, to request portability, and to lodge a complaint with your local
        data protection authority. To exercise any of these rights, contact us at
        hello@newsshore.com.
      </p>

      <h2 style={h2s}>8. Children</h2>
      <p style={ps}>
        The website is not directed at children under 13 (or, in the EEA, under 16), and we
        do not knowingly collect personal information from children.
      </p>

      <h2 style={h2s}>9. International transfers</h2>
      <p style={ps}>
        Your information may be processed in countries other than your own. Where this
        occurs, appropriate safeguards are applied in accordance with applicable law.
      </p>

      <h2 style={h2s}>10. Changes to this policy</h2>
      <p style={ps}>
        We may update this policy from time to time. Changes will be posted on this page
        with a revised effective date.
      </p>

      <h2 style={h2s}>11. Contact</h2>
      <p style={ps}>Questions about this policy can be sent to hello@newsshore.com.</p>
    </div>
  );
}
