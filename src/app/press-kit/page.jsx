const wrap = { maxWidth: '760px', margin: '0 auto', padding: '56px 20px 96px' };
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const h2s = { fontSize: '1.2rem', fontWeight: 700, marginTop: '40px', marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };
const uls = { marginTop: '6px', marginBottom: '14px', paddingLeft: '26px', lineHeight: 1.7 };

export default function PressKitPage() {
  return (
    <div style={wrap}>
      <h1 style={h1s}>Press Kit</h1>

      <h2 style={h2s}>About NewsShore</h2>
      <p style={ps}>
        NewsShore is an independent digital publication delivering concise technology news
        coverage for readers who need to stay current without the noise. The publication
        aggregates and distills reporting from leading sources across artificial intelligence,
        the major technology companies, consumer technology, startups and funding, research,
        and global technology markets, with an emphasis on clarity and brevity. NewsShore was
        launched in 2026.
      </p>

      <h2 style={h2s}>Coverage areas</h2>
      <ul style={uls}>
        <li>Artificial intelligence and machine learning</li>
        <li>Technology companies and platforms</li>
        <li>Consumer technology and gadgets</li>
        <li>Startups, venture funding, and acquisitions</li>
        <li>Research and development</li>
        <li>Deals and pricing</li>
        <li>Global and China technology markets</li>
      </ul>

      <h2 style={h2s}>Brand assets</h2>
      <p style={ps}>
        Logos and brand assets are available to members of the press on request. Until a
        downloadable kit is published, please contact
        <strong> hello@newsshore.com</strong> with the subject line "Press Kit".
      </p>

      <h2 style={h2s}>Referring to NewsShore</h2>
      <p style={ps}>
        In print and online, please refer to the publication as NewsShore — one word, with
        both capitals. For interviews or statements, please use the contact details above.
      </p>
    </div>
  );
}
