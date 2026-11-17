import PageHeader from '../components/PageHeader';

const wrap = { maxWidth: '760px', margin: '0 auto', padding: '128px 20px 96px' };
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const h2s = { fontSize: '1.2rem', fontWeight: 700, marginTop: '40px', marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };
const uls = { marginTop: '6px', marginBottom: '14px', paddingLeft: '26px', lineHeight: 1.7 };

export default function AccessibilityPage() {
  return (
    <div style={wrap}>
      <PageHeader />
      <h1 style={h1s}>Accessibility</h1>
      <p style={ps}>
        NewsShore is committed to ensuring that this website is accessible to all readers,
        including those with disabilities.
      </p>

      <h2 style={h2s}>Conformance target</h2>
      <p style={ps}>
        We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA.
      </p>

      <h2 style={h2s}>Measures we take</h2>
      <ul style={uls}>
        <li>Semantic page structure with descriptive headings</li>
        <li>Readable typography and attention to color contrast</li>
        <li>Text alternatives for meaningful images</li>
        <li>Navigation and interactive elements operable by keyboard</li>
      </ul>

      <h2 style={h2s}>Known limitations</h2>
      <p style={ps}>
        NewsShore is a newly launched publication, and some areas of the website may not yet
        fully conform to our target. We treat accessibility defects as priority fixes and
        improve the site on an ongoing basis.
      </p>

      <h2 style={h2s}>Feedback</h2>
      <p style={ps}>
        If you encounter an accessibility barrier, please contact
        <strong> hello@newsshore.com</strong> with the subject line "Accessibility". We aim
        to respond within five business days.
      </p>
    </div>
  );
}
