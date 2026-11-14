const wrap = { maxWidth: '760px', margin: '0 auto', padding: '56px 20px 96px' };
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };
const uls = { marginTop: '6px', marginBottom: '14px', paddingLeft: '26px', lineHeight: 1.7 };

export default function ContactPage() {
  return (
    <div style={wrap}>
      <h1 style={h1s}>Contact</h1>
      <p style={ps}>NewsShore can be reached by email at:</p>
      <p style={{ ...ps, fontSize: '1.15rem' }}><strong>newsshore@gmail.com</strong></p>
      <p style={ps}>To help us direct your message, please use the following subject lines:</p>
      <ul style={uls}>
        <li><strong>General</strong> — inquiries and reader feedback</li>
        <li><strong>Correction</strong> — errors in published coverage</li>
        <li><strong>Tip</strong> — news tips and story suggestions</li>
        <li><strong>Advertising</strong> — advertising and partnership inquiries</li>
      </ul>
      <p style={ps}>
        We read every message and aim to respond within two business days. Corrections are
        reviewed on priority; where a correction is warranted, the affected article will be
        updated with a reference to the change.
      </p>
    </div>
  );
}
