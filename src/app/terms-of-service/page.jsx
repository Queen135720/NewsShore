import PageHeader from '../components/PageHeader';

const wrap = { maxWidth: '760px', margin: '0 auto', padding: '128px 20px 96px' }
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const h2s = { fontSize: '1.2rem', fontWeight: 700, marginTop: '40px', marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };

export default function TermsPage() {
  return (
    <div style={wrap}>
      <PageHeader />
      <h1 style={h1s}>Terms of Service</h1>
      <p style={{ ...ps, opacity: 0.75 }}><em>Effective date: November 15, 2026</em></p>

      <h2 style={h2s}>1. Acceptance of these terms</h2>
      <p style={ps}>
        By accessing or using NewsShore, you agree to these Terms of Service.
        If you do not agree, please discontinue use of the Site.
      </p>

      <h2 style={h2s}>2. The service</h2>
      <p style={ps}>
        NewsShore is an independent digital technology publication. Our coverage includes
        summaries and derivative reporting based on articles originally published by
        third-party sources. Where coverage is based on another publisher's reporting, the
        underlying source is credited and linked wherever possible.
      </p>

      <h2 style={h2s}>3. Content standards and accuracy</h2>
      <p style={ps}>
        Articles may be produced or summarized with the assistance of automated systems.
        While we aim for accuracy and timeliness, automated processes can introduce errors,
        and coverage may be incomplete. Content is provided for general information only.
        We encourage readers to verify critical information through the linked sources.
        Nothing on the Site constitutes professional, financial, legal, or investment advice.
      </p>

      <h2 style={h2s}>4. Intellectual property</h2>
      <p style={ps}>
        The Site's design, compilation, and original editorial content are the property of
        the Operator. Third-party content remains the property of its respective owners and
        is referenced with attribution and linking. All trademarks are the property of their
        respective owners.
      </p>

      <h2 style={h2s}>5. Acceptable use</h2>
      <p style={ps}>
        You agree not to: use the Site for any unlawful purpose; attempt to gain
        unauthorized access to the Site or its infrastructure; interfere with the Site's
        operation; or misrepresent your affiliation with NewsShore.
      </p>

      <h2 style={h2s}>6. Third-party links</h2>
      <p style={ps}>
        The Site contains links to external websites for reference and attribution. We do
        not control and are not responsible for the content of those websites.
      </p>

      <h2 style={h2s}>7. Disclaimer of warranties</h2>
      <p style={ps}>
        The Site is provided on an "as is" and "as available" basis, without warranties of
        any kind, express or implied, including but not limited to warranties of accuracy,
        availability, merchantability, or fitness for a particular purpose.
      </p>

      <h2 style={h2s}>8. Limitation of liability</h2>
      <p style={ps}>
        To the maximum extent permitted by applicable law, the Operator shall not be liable
        for any indirect, incidental, special, consequential, or punitive damages, or for any
        loss of data, profit, or goodwill, arising from or related to your use of the Site.
      </p>

      <h2 style={h2s}>9. Indemnification</h2>
      <p style={ps}>
        You agree to indemnify and hold harmless the Operator against any claims,
        liabilities, and expenses arising from your violation of these terms.
      </p>

      <h2 style={h2s}>10. Changes to the service and these terms</h2>
      <p style={ps}>
        We may modify or discontinue the Site, or any part of it, at any time. We may update
        these terms from time to time; changes are effective when posted on this page with a
        revised effective date. Continued use of the Site after changes are posted
        constitutes acceptance of the updated terms.
      </p>

      <h2 style={h2s}>11. Governing law</h2>
      <p style={ps}>
        These terms are governed by the laws of the Unite States, without regard to conflict-of-law
        rules.
      </p>

      <h2 style={h2s}>12. Contact</h2>
      <p style={ps}>Questions about these terms can be sent to hello@newsshore.com.</p>
    </div>
  );
}
