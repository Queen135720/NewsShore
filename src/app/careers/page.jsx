const wrap = { maxWidth: '760px', margin: '0 auto', padding: '56px 20px 96px' };
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };

export default function CareersPage() {
  return (
    <div style={wrap}>
      <h1 style={h1s}>Careers</h1>
      <p style={ps}>
        NewsShore is a newly established AI & technology publication. Our newsroom is
        intentionally small at this stage, and our priority is the quality, accuracy, and
        consistency of our coverage.
      </p>
      <p style={ps}>
        There are no open positions at this time. As the publication grows, vacancies will be
        announced on this page. We thank you for your interest in working with NewsShore.
      </p>
    </div>
  );
}
