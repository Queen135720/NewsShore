const wrap = { maxWidth: '760px', margin: '0 auto', padding: '56px 20px 96px' };
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const h2s = { fontSize: '1.2rem', fontWeight: 700, marginTop: '40px', marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };

export default function CookiePolicyPage() {
  return (
    <div style={wrap}>
      <h1 style={h1s}>Cookie Policy</h1>
      <p style={{ ...ps, opacity: 0.75 }}><em>Effective date: November 15, 2026</em></p>

      <h2 style={h2s}>1. What cookies are</h2>
      <p style={ps}>
        Cookies are small text files that a website stores on your device. They allow the
        site to remember your actions and preferences, and help website operators understand
        how the site is used.
      </p>

      <h2 style={h2s}>2. Cookies we use</h2>
      <p style={ps}>
        <strong>Strictly necessary cookies.</strong> These are required for the website to
        function — for example, to maintain security and deliver content. They cannot be
        switched off.
      </p>
      <p style={ps}>
        <strong>Analytics cookies.</strong> These help us understand, in aggregate, which
        pages are read and how visitors move through the site, so we can improve our coverage
        and layout. Where possible, the data is aggregated or anonymized.
      </p>
      <p style={ps}>
        <strong>Preference cookies.</strong> Where the site offers optional features, these
        remember the choices you make, such as display or category preferences.
      </p>

      <h2 style={h2s}>3. Third-party cookies</h2>
      <p style={ps}>
        Hosting, infrastructure, and analytics providers may set their own cookies when you
        visit. These are governed by the respective providers' privacy policies.
      </p>

      <h2 style={h2s}>4. Managing cookies</h2>
      <p style={ps}>
        You can control and delete cookies through your browser settings. Note that blocking
        strictly necessary cookies may affect parts of the website.
      </p>

      <h2 style={h2s}>5. Changes</h2>
      <p style={ps}>
        We may update this policy from time to time. Changes will be posted on this page
        with a revised effective date. This policy supplements our Privacy Policy.
      </p>

      <h2 style={h2s}>6. Contact</h2>
      <p style={ps}>Questions about cookies can be sent to hello@newsshore.com.</p>
    </div>
  );
}
